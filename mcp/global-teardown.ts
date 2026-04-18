/**
 * Playwright globalTeardown — runs once after all tests complete.
 *
 * MCP connections are per-test and cleaned up when each test ends.
 * Trend history is written by reporters/visual-diff-reporter.ts
 * (single writer — avoids the previous duplicate-entry issue).
 */
export default async function globalTeardown(): Promise<void> {
  console.log('[globalTeardown] VR_agent test run complete.');
}
