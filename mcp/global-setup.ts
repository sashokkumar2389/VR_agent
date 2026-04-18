/**
 * Playwright globalSetup — runs once before all tests.
 *
 * MCP connections are now created per-test (paired with the test's own
 * BrowserContext), so there is no global server process to start here.
 * This hook is kept for forward-compatibility and run-level logging.
 */
export default async function globalSetup(): Promise<void> {
  console.log('[globalSetup] VR_agent test run starting.');
}
