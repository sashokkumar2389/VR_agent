import type { BrowserContext, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types — internal @playwright/mcp runtime shapes
//
// The public Connection type only exposes { server, close() }.  At runtime
// the internal class also exposes `context` which holds the registered MCP
// tools and can execute them directly — we type that shape here.
// ---------------------------------------------------------------------------

interface MCPToolResult {
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
}

interface MCPTool {
    schema: { name: string; title?: string; description?: string };
}

interface MCPContext {
    tools: MCPTool[];
    run(tool: MCPTool, args: Record<string, unknown>): Promise<MCPToolResult>;
}

/**
 * Internal connection shape — extends the public @playwright/mcp Connection
 * with the `context` property that exists at runtime.
 */
export interface MCPConnection {
    server: unknown;
    context: MCPContext;
    close(): Promise<void>;
}

export interface MCPResponse {
    content: string;
    success: boolean;
    durationMs: number;
}

// ---------------------------------------------------------------------------
// Connection factory
// ---------------------------------------------------------------------------

/**
 * Creates an in-process MCP connection that shares the provided BrowserContext.
 *
 * MCP tools (browser_navigate, browser_click, browser_snapshot, …) will
 * operate on pages within this context.  Because the test's own page lives
 * in the same context, cookies and storage set by MCP carry over to the test.
 */
export async function createMCPConnection(
    browserContext: BrowserContext,
): Promise<MCPConnection> {
    // Dynamic import — @playwright/mcp is an ESM-only package.
    // TypeScript preserves import() as a native dynamic import when
    // module=CommonJS, so Node.js CJS can load the ESM package at runtime.
    const mod: { createConnection: Function } = await import('@playwright/mcp');

    const connection = await mod.createConnection(
        {},
        () => Promise.resolve(browserContext),
    );

    return connection as unknown as MCPConnection;
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

/**
 * Calls a named MCP tool and returns a simplified response.
 *
 * Available tools include browser_navigate, browser_snapshot, browser_click,
 * browser_type, browser_wait_for_event, etc.
 */
export async function callTool(
    connection: MCPConnection,
    toolName: string,
    args: Record<string, unknown> = {},
): Promise<MCPResponse> {
    const start = Date.now();

    const tool = connection.context.tools.find(
        (t) => t.schema.name === toolName,
    );

    if (!tool) {
        return {
            content: `MCP tool "${toolName}" not found`,
            success: false,
            durationMs: Date.now() - start,
        };
    }

    try {
        const result = await connection.context.run(tool, args);

        const text = result.content
            .filter((c) => c.type === 'text' && c.text)
            .map((c) => c.text!)
            .join('\n');

        return {
            content: text,
            success: !result.isError,
            durationMs: Date.now() - start,
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: message,
            success: false,
            durationMs: Date.now() - start,
        };
    }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Closes extra pages MCP may have created inside the shared BrowserContext,
 * leaving only the test's original page untouched.
 *
 * NOTE: We intentionally do NOT call connection.close() because that would
 * invoke browserContext.close() and tear down the test's own context.
 */
export async function cleanupMCPPages(
    browserContext: BrowserContext,
    testPage: Page,
): Promise<void> {
    for (const p of browserContext.pages()) {
        if (p !== testPage) {
            await p.close().catch(() => { /* ignore */ });
        }
    }
}
