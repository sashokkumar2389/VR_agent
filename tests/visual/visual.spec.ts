import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getPageConfigs } from '../../config/global.config';
import { MCPOrchestrator, TestResult } from '../../mcp/mcp-orchestrator';
import { createMCPConnection, cleanupMCPPages } from '../../mcp/mcp-client';
import { stabilizePage, StabilizationLevel } from '../../utils/page-stabilizer';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Cookie injection — suppress KPMG consent banners deterministically
// ---------------------------------------------------------------------------

interface CookieEntry {
    name: string;
    value: string;
    domain: string;
    path: string;
}

interface CookiesConfig {
    cookies: CookieEntry[];
}

const COOKIES_PATH = resolve(__dirname, '../../config/cookies.json');
const CONSENT_COOKIES: CookieEntry[] =
    (JSON.parse(readFileSync(COOKIES_PATH, 'utf-8')) as CookiesConfig).cookies;

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
    // Inject consent cookies before each test so the banner never appears
    test.beforeEach(async ({ context }) => {
        await context.addCookies(CONSENT_COOKIES);
    });

    for (const pageConfig of PAGE_CONFIGS) {
        test(`${pageConfig.name}`, async ({ page, browserName }, testInfo) => {
            logger.flush(); // Reset log buffer — prevents cross-test bleed
            const level = stabilizationLevel(testInfo.retry);

            logger.info('visual.spec', `Starting test`, {
                page: pageConfig.name,
                browser: browserName,
                attempt: testInfo.retry + 1,
                level,
            });

            // ------------------------------------------------------------------
            // Step 1 — MCP-guided navigation and cookie dismissal
            // MCP creates a temporary page in the test's shared BrowserContext,
            // navigates to the URL, and dismisses cookie banners.  Cookies
            // carry over to the test's own page via the shared context.
            // If MCP is unavailable, Playwright continues independently.
            // ------------------------------------------------------------------
            let mcpResult: TestResult | null = null;
            let orchestrator: MCPOrchestrator | null = null;
            try {
                const connection = await createMCPConnection(page.context());
                orchestrator = new MCPOrchestrator(connection);
                mcpResult = await orchestrator.orchestratePageTest(pageConfig, browserName);

                // Close any extra pages MCP created in the shared context
                await cleanupMCPPages(page.context(), page);

                if (mcpResult.status === 'error') {
                    logger.warn('visual.spec', 'MCP orchestration fallback — Playwright-only stabilization', {
                        page: pageConfig.name,
                    });
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.warn('visual.spec', 'MCP unavailable — using Playwright-only stabilization', {
                    error: message,
                });
            }

            // Attach MCP logs to the Playwright report for debugging
            if (mcpResult && (testInfo.retry > 0 || process.env['DEBUG'] === 'true')) {
                await testInfo.attach('mcp-logs', {
                    body: JSON.stringify(mcpResult.mcpLogs, null, 2),
                    contentType: 'application/json',
                });
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

            // Log comparison result via compare-and-report template (Architecture §9.2)
            orchestrator?.logComparisonResult(pageConfig, browserName, true);

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
