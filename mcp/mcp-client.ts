import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MCPResponse {
    content: string;
    success: boolean;
    durationMs: number;
}

interface MCPServerInfo {
    pid: number;
    port: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVER_INFO_PATH = resolve(__dirname, '../.mcp-server.json');
const MCP_DEFAULT_PORT = 3001;
const CONNECTION_TIMEOUT_MS = 15000;
const PROMPT_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// MCPClient
// ---------------------------------------------------------------------------

export class MCPClient {
    private serverProcess: ChildProcess | null = null;
    private connected = false;
    private port: number = MCP_DEFAULT_PORT;

    /**
     * Starts the MCP server and waits for it to be ready.
     */
    async initialize(): Promise<void> {
        console.log('[MCPClient] Starting MCP server…');

        this.serverProcess = spawn(
            'npx',
            ['@playwright/mcp', '--port', String(MCP_DEFAULT_PORT)],
            {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                env: { ...process.env },
            }
        );

        this.port = MCP_DEFAULT_PORT;

        // Capture stderr for diagnostics
        this.serverProcess.stderr?.on('data', (chunk: Buffer) => {
            if (process.env['DEBUG'] === 'true') {
                console.debug('[MCPClient:stderr]', chunk.toString().trim());
            }
        });

        this.serverProcess.on('error', (err) => {
            console.error('[MCPClient] Server process error:', err.message);
        });

        // Persist PID so globalTeardown can clean up even if the process reference is lost
        const info: MCPServerInfo = {
            pid: this.serverProcess.pid ?? 0,
            port: this.port,
        };
        writeFileSync(SERVER_INFO_PATH, JSON.stringify(info, null, 2));

        await this.waitForReady();
        this.connected = true;
        console.log(`[MCPClient] MCP server ready on port ${this.port}`);
    }

    /**
     * Sends a prompt to the MCP server and returns its response.
     */
    async sendPrompt(prompt: string): Promise<MCPResponse> {
        if (!this.connected) {
            throw new Error('[MCPClient] Not connected. Call initialize() first.');
        }

        const start = Date.now();
        const endpoint = `http://localhost:${this.port}/prompt`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROMPT_TIMEOUT_MS);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                return {
                    content: text,
                    success: false,
                    durationMs: Date.now() - start,
                };
            }

            const json = (await response.json()) as { content?: string };
            return {
                content: json.content ?? '',
                success: true,
                durationMs: Date.now() - start,
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: message,
                success: false,
                durationMs: Date.now() - start,
            };
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Gracefully shuts down the MCP server.
     */
    async shutdown(): Promise<void> {
        this.connected = false;

        if (this.serverProcess && !this.serverProcess.killed) {
            console.log('[MCPClient] Shutting down MCP server…');
            this.serverProcess.kill('SIGTERM');
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        }

        // Also clean up any orphaned process from a previous run
        if (existsSync(SERVER_INFO_PATH)) {
            try {
                const info = JSON.parse(readFileSync(SERVER_INFO_PATH, 'utf-8')) as MCPServerInfo;
                if (info.pid && info.pid !== this.serverProcess?.pid) {
                    process.kill(info.pid, 'SIGTERM');
                }
            } catch {
                // Process may already be gone
            }
            unlinkSync(SERVER_INFO_PATH);
        }

        this.serverProcess = null;
    }

    /**
     * Returns true if the MCP server connection is active.
     */
    isConnected(): boolean {
        return this.connected;
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private async waitForReady(): Promise<void> {
        const deadline = Date.now() + CONNECTION_TIMEOUT_MS;
        const healthUrl = `http://localhost:${this.port}/health`;

        while (Date.now() < deadline) {
            try {
                const res = await fetch(healthUrl);
                if (res.ok) return;
            } catch {
                // Server not yet up; keep waiting
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
        }

        throw new Error(
            `[MCPClient] MCP server did not become ready within ${CONNECTION_TIMEOUT_MS}ms`
        );
    }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let _client: MCPClient | null = null;

export function getMCPClient(): MCPClient {
    if (!_client) {
        _client = new MCPClient();
    }
    return _client;
}

export function resetMCPClient(): void {
    _client = null;
}
