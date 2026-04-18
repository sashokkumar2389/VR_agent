import { Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { PageConfig } from '../config/global.config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonResult {
    match: boolean;
    baselineExists: boolean;
    /** Ratio of different bytes (0–1). Approximate — use toHaveScreenshot for pixel accuracy. */
    approxDiffRatio: number;
    baselinePath: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const BASELINES_DIR = resolve(__dirname, '../baselines');

export function baselinePath(pageName: string, browser: string): string {
    return resolve(BASELINES_DIR, browser, `${pageName}.png`);
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Captures a full-page screenshot with page-specific mask selectors applied.
 * Returns the screenshot as a Buffer.
 */
export async function captureFullPage(page: Page, config: PageConfig): Promise<Buffer> {
    const maskLocators = config.maskSelectors.map((sel) => page.locator(sel));

    const screenshot = await page.screenshot({
        fullPage: true,
        animations: 'disabled',
        mask: maskLocators,
        maskColor: '#FF00FF', // Magenta mask — clearly artificial, never a natural page colour
    });

    return screenshot;
}

// ---------------------------------------------------------------------------
// Baseline management
// ---------------------------------------------------------------------------

/**
 * Writes a screenshot buffer to baselines/{browser}/{pageName}.png.
 * Creates the directory if it does not exist.
 */
export function saveBaseline(screenshot: Buffer, pageName: string, browser: string): void {
    const target = baselinePath(pageName, browser);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, screenshot);

    if (process.env['DEBUG'] === 'true') {
        console.debug(`[ScreenshotHelper] Baseline saved: ${target}`);
    }
}

// ---------------------------------------------------------------------------
// Comparison (lightweight — primary assertion is toHaveScreenshot in test spec)
// ---------------------------------------------------------------------------

/**
 * Compares a screenshot buffer against the stored baseline file.
 *
 * WARNING: This is a byte-level comparison of raw PNG file buffers, NOT a
 * pixel-level comparison. Two visually identical images with different PNG
 * compression parameters will register as different. This means the
 * diff-reviewer may surface false positives that Playwright's own
 * `toHaveScreenshot()` (which decodes to raw pixels) would correctly pass.
 *
 * Use this only as a fast pre-filter. The authoritative regression assertion
 * is `toHaveScreenshot()` in visual.spec.ts.
 */
export function compareWithBaseline(
    actual: Buffer,
    pageName: string,
    browser: string,
    _config: PageConfig
): ComparisonResult {
    const target = baselinePath(pageName, browser);

    if (!existsSync(target)) {
        return {
            match: false,
            baselineExists: false,
            approxDiffRatio: 1,
            baselinePath: target,
        };
    }

    const baseline = readFileSync(target);

    if (baseline.length !== actual.length) {
        const larger = Math.max(baseline.length, actual.length);
        return {
            match: false,
            baselineExists: true,
            approxDiffRatio: Math.abs(baseline.length - actual.length) / larger,
            baselinePath: target,
        };
    }

    // Count differing bytes over a sampled window (every 16th byte) for speed
    let diffBytes = 0;
    const sampleStep = 16;
    const sampleCount = Math.floor(baseline.length / sampleStep);

    for (let i = 0; i < baseline.length; i += sampleStep) {
        if (baseline[i] !== actual[i]) diffBytes++;
    }

    const approxDiffRatio = sampleCount > 0 ? diffBytes / sampleCount : 0;

    return {
        match: approxDiffRatio === 0,
        baselineExists: true,
        approxDiffRatio,
        baselinePath: target,
    };
}

/**
 * Returns the path where Playwright stores its generated diff overlay for a
 * failed toHaveScreenshot assertion (test-results directory).
 *
 * The actual pixel-level diff image is generated automatically by Playwright
 * when toHaveScreenshot() fails. This function resolves the expected path so
 * the diff-reviewer can locate and display it.
 */
export function getDiffOverlayPath(pageName: string, browser: string): string {
    return resolve(
        __dirname,
        '../test-results',
        `visual-${pageName}-${browser}`,
        `${pageName}-diff.png`
    );
}
