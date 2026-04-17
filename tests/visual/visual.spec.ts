import { test, expect } from '@playwright/test';
import { getPageConfigs } from '../../config/global.config';
import { MCPOrchestrator } from '../../mcp/mcp-orchestrator';
import { getMCPClient } from '../../mcp/mcp-client';
import { stabilizePage, StabilizationLevel } from '../../utils/page-stabilizer';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Data-driven visual regression test suite
//
// Execution model (ARCHITECTURE.md §15.1):
//   Worker 1 — Chromium: runs all 6 pages sequentially
//   Worker 2 — Firefox:  runs all 6 pages sequentially
//   Both workers run in parallel (workers: 2, fullyParallel: false)
//
// Baseline paths (playwright.config.ts snapshotPathTemplate):
//   baselines/{browser}/{pageName}.png
// ---------------------------------------------------------------------------

const PAGE_CONFIGS = getPageConfigs();

// Map Playwright retry index (0-based) to stabilization level
function stabilizationLevel(retryIndex: number): StabilizationLevel {
    if (retryIndex >= 2) return 'maximum';
    if (retryIndex >= 1) return 'extended';
    return 'standard';
}

test.describe('Visual Regression', () => {
    for (const pageConfig of PAGE_CONFIGS) {
        test(`${pageConfig.name}`, async ({ page, browserName }, testInfo) => {
            const level = stabilizationLevel(testInfo.retry);

            logger.info('visual.spec', `Starting test`, {
                page: pageConfig.name,
                browser: browserName,
                attempt: testInfo.retry + 1,
                level,
            });

            // ------------------------------------------------------------------
            // Step 1 — MCP-guided navigation and cookie dismissal
            // MCP drives AI-level instructions (cookie banners, carousel pausing).
            // If MCP is unavailable, Playwright continues independently.
            // ------------------------------------------------------------------
            const mcpClient = getMCPClient();
            if (mcpClient.isConnected()) {
                const orchestrator = new MCPOrchestrator();
                const result = await orchestrator.orchestratePageTest(pageConfig, browserName);

                if (result.status === 'error') {
                    logger.warn('visual.spec', `MCP orchestration warning — using Playwright-only stabilization`, {
                        page: pageConfig.name,
                    });
                }

                // Attach MCP logs to the Playwright report for debugging
                if (testInfo.retry > 0 || process.env['DEBUG'] === 'true') {
                    await testInfo.attach('mcp-logs', {
                        body: JSON.stringify(result.mcpLogs, null, 2),
                        contentType: 'application/json',
                    });
                }
            }

            // ------------------------------------------------------------------
            // Step 2 — Navigate (Playwright-level)
            // MCP may have already navigated. Playwright navigates independently
            // to ensure the test page object is on the correct URL.
            // ------------------------------------------------------------------
            await page.goto(pageConfig.url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
            });

            // ------------------------------------------------------------------
            // Step 3 — Playwright-level page stabilization
            // Progressive level escalates on each retry attempt.
            // ------------------------------------------------------------------
            await stabilizePage(page, pageConfig, level);

            // ------------------------------------------------------------------
            // Step 4 — Visual assertion
            // toHaveScreenshot() handles: baseline creation, pixel diff, diff
            // overlay generation, and pass/fail verdict.
            // Baselines stored at: baselines/{browserName}/{pageName}.png
            // ------------------------------------------------------------------
            const maskLocators = pageConfig.maskSelectors.map((sel) => page.locator(sel));

            await expect(page).toHaveScreenshot([`${pageConfig.name}.png`], {
                fullPage: true,
                maxDiffPixelRatio: pageConfig.maxDiffPixelRatio,
                animations: 'disabled',
                mask: maskLocators.length > 0 ? maskLocators : undefined,
            });

            logger.info('visual.spec', `Test passed`, { page: pageConfig.name, browser: browserName });

            // Attach structured logs to report on retry or in DEBUG mode
            if (testInfo.retry > 0 || process.env['DEBUG'] === 'true') {
                await testInfo.attach('stabilizer-logs', {
                    body: logger.snapshot(),
                    contentType: 'application/json',
                });
            }
        });
    }
});
