import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { getPageConfigs } from '../../config/global.config';
import { baselinePath } from '../../utils/screenshot-helper';
import { stabilizePage } from '../../utils/page-stabilizer';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Zero-diff validation suite — Phase 0 success criterion
//
// ARCHITECTURE.md §17:
//   "Running the test suite twice consecutively with no code changes produces
//    ZERO diffs across all 12 screenshots (6 pages × 2 browsers)."
//
// This spec validates that:
//   1. All 12 baseline PNGs exist in baselines/{browser}/{pageName}.png
//   2. A fresh capture of each page matches its baseline with ZERO diff
//
// Run AFTER `npm test` has already generated baselines.
// Usage: npx playwright test tests/validation/zero-diff.spec.ts
// ---------------------------------------------------------------------------

const PAGE_CONFIGS = getPageConfigs();
const BROWSERS = ['chromium', 'firefox'];

test.describe('Zero-diff baseline validation', () => {
    // Guard: verify all baseline files exist before running any comparison
    test('all baseline files exist', () => {
        const missing: string[] = [];

        for (const browser of BROWSERS) {
            for (const page of PAGE_CONFIGS) {
                const path = baselinePath(page.name, browser);
                if (!existsSync(path)) {
                    missing.push(`baselines/${browser}/${page.name}.png`);
                }
            }
        }

        if (missing.length > 0) {
            throw new Error(
                `Missing baseline files (run \`npm run update-baselines\` first):\n${missing.join('\n')}`
            );
        }

        logger.info('zero-diff', `All ${BROWSERS.length * PAGE_CONFIGS.length} baseline files present`);
        expect(missing).toHaveLength(0);
    });

    // Per-page zero-diff assertions — run in the context of each browser project
    for (const pageConfig of PAGE_CONFIGS) {
        test(`${pageConfig.name} — zero diff`, async ({ page, browserName }, testInfo) => {
            logger.info('zero-diff', `Validating baseline determinism`, {
                page: pageConfig.name,
                browser: browserName,
            });

            // Navigate
            await page.goto(pageConfig.url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
            });

            // Stabilize at standard level (no retries needed for this validation run)
            await stabilizePage(page, pageConfig, 'standard');

            const maskLocators = pageConfig.maskSelectors.map((sel) => page.locator(sel));

            // Strict zero-diff assertion — no tolerance beyond what the page config allows
            await expect(page).toHaveScreenshot([`${pageConfig.name}.png`], {
                fullPage: true,
                maxDiffPixelRatio: pageConfig.maxDiffPixelRatio,
                animations: 'disabled',
                mask: maskLocators.length > 0 ? maskLocators : undefined,
            });

            logger.info('zero-diff', `Zero diff confirmed`, {
                page: pageConfig.name,
                browser: browserName,
            });

            // Attach logs in DEBUG mode
            if (process.env['DEBUG'] === 'true') {
                await testInfo.attach('validation-logs', {
                    body: logger.snapshot(),
                    contentType: 'application/json',
                });
            }
        });
    }
});
