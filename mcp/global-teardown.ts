import { getMCPClient } from './mcp-client';
import { appendTrendEntry } from '../utils/trend-writer';

/**
 * Playwright globalTeardown — runs once after all tests complete.
 * Gracefully shuts down the MCP server and finalises the trend log.
 */
export default async function globalTeardown(): Promise<void> {
  const client = getMCPClient();

  try {
    await client.shutdown();
    console.log('[globalTeardown] MCP server shut down successfully.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[globalTeardown] MCP shutdown warning: ${message}`);
  }

  try {
    await appendTrendEntry();
    console.log('[globalTeardown] Trend history updated.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[globalTeardown] Trend writer warning: ${message}`);
  }
}
