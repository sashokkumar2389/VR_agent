// ---------------------------------------------------------------------------
// Structured logger for VR_agent
//
// Usage:
//   import { logger } from './logger';
//   logger.info('PageStabilizer', 'Stabilizing "homepage" at level=standard');
//   logger.debug('MCPOrchestrator', 'Prompt sent', { durationMs: 120 });
//
// Set DEBUG=true in the environment to enable debug-level output.
// ---------------------------------------------------------------------------

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    component: string;
    message: string;
    meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// In-memory log buffer — lets test specs attach logs to Playwright reports
// ---------------------------------------------------------------------------

class Logger {
    private buffer: LogEntry[] = [];
    private readonly debugEnabled: boolean;

    constructor() {
        this.debugEnabled = process.env['DEBUG'] === 'true';
    }

    debug(component: string, message: string, meta?: Record<string, unknown>): void {
        if (!this.debugEnabled) return;
        this.emit('DEBUG', component, message, meta);
    }

    info(component: string, message: string, meta?: Record<string, unknown>): void {
        this.emit('INFO', component, message, meta);
    }

    warn(component: string, message: string, meta?: Record<string, unknown>): void {
        this.emit('WARN', component, message, meta);
    }

    error(component: string, message: string, meta?: Record<string, unknown>): void {
        this.emit('ERROR', component, message, meta);
    }

    /**
     * Returns and clears the in-memory log buffer.
     * Call this in the test spec to attach logs to the Playwright HTML report.
     */
    flush(): LogEntry[] {
        const entries = [...this.buffer];
        this.buffer = [];
        return entries;
    }

    /**
     * Returns a JSON string of all buffered entries without clearing the buffer.
     */
    snapshot(): string {
        return JSON.stringify(this.buffer, null, 2);
    }

    // ---------------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------------

    private emit(
        level: LogLevel,
        component: string,
        message: string,
        meta?: Record<string, unknown>
    ): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message,
            ...(meta !== undefined ? { meta } : {}),
        };

        this.buffer.push(entry);
        this.print(entry);
    }

    private print(entry: LogEntry): void {
        const prefix = `[${entry.timestamp}] [${entry.level.padEnd(5)}] [${entry.component}]`;
        const metaStr =
            entry.meta !== undefined ? ` ${JSON.stringify(entry.meta)}` : '';
        const line = `${prefix} ${entry.message}${metaStr}`;

        switch (entry.level) {
            case 'ERROR':
                console.error(line);
                break;
            case 'WARN':
                console.warn(line);
                break;
            case 'DEBUG':
                console.debug(line);
                break;
            default:
                console.log(line);
        }
    }
}

// Singleton — shared across the process
export const logger = new Logger();
