import { getMCPClient } from './mcp-client';

/**
 * Playwright globalSetup — runs once before all tests.
 * Starts the MCP server and verifies it is healthy.
 */
export default async function globalSetup(): Promise<void> {
  const client = getMCPClient();

  try {
    await client.initialize();
    console.log('[globalSetup] MCP server started successfully.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[globalSetup] FATAL: MCP server failed to start — ${message}`);
    // Re-throw so Playwright aborts the run rather than proceeding without MCP
    throw err;
  }
}
