import { createInterface } from 'readline';
import { existsSync, readFileSync, copyFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import { baselinePath, getDiffOverlayPath } from './screenshot-helper';
import { getPageConfigs } from '../config/global.config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewDecision = 'approve' | 'reject' | 'skip';

export interface ReviewResult {
    pageName: string;
    browser: string;
    decision: ReviewDecision;
    baselinePath: string;
}

interface CandidateScreenshot {
    pageName: string;
    browser: string;
    actualPath: string;
    baselinePath: string;
    diffPath: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_RESULTS_DIR = resolve(__dirname, '../test-results');
const BROWSERS = ['chromium', 'firefox'];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Interactive human-in-the-loop baseline approval workflow.
 *
 * For each screenshot that differs from its baseline:
 *   1. Opens the baseline, actual, and diff overlay in the system viewer
 *   2. Prompts: [A]pprove  [R]eject  [S]kip
 *   3. On Approve: overwrites baseline with new screenshot
 *   4. On Reject:  keeps existing baseline, logs rejection
 */
export async function runDiffReviewer(): Promise<ReviewResult[]> {
    const candidates = collectCandidates();

    if (candidates.length === 0) {
        console.log('[DiffReviewer] No changed screenshots found. Nothing to review.');
        return [];
    }

    console.log(`\n[DiffReviewer] Found ${candidates.length} screenshot(s) to review.\n`);

    const results: ReviewResult[] = [];

    for (const candidate of candidates) {
        const result = await reviewOne(candidate);
        results.push(result);
    }

    printSummary(results);
    return results;
}

// ---------------------------------------------------------------------------
// Candidate discovery
// ---------------------------------------------------------------------------

/**
 * Collects all actual screenshots from test-results that differ from the
 * stored baselines. Also picks up cases where no baseline exists yet.
 */
function collectCandidates(): CandidateScreenshot[] {
    const pageConfigs = getPageConfigs();
    const candidates: CandidateScreenshot[] = [];

    for (const browser of BROWSERS) {
        for (const page of pageConfigs) {
            // Playwright writes actual screenshots into test-results during a run
            const actualDir = resolve(TEST_RESULTS_DIR, `visual-${page.name}-${browser}`);
            const actualFile = resolve(actualDir, `${page.name}-actual.png`);

            if (!existsSync(actualFile)) continue;

            const baseline = baselinePath(page.name, browser);
            const diff = getDiffOverlayPath(page.name, browser);

            candidates.push({
                pageName: page.name,
                browser,
                actualPath: actualFile,
                baselinePath: baseline,
                diffPath: existsSync(diff) ? diff : null,
            });
        }
    }

    return candidates;
}

// ---------------------------------------------------------------------------
// Single review
// ---------------------------------------------------------------------------

async function reviewOne(candidate: CandidateScreenshot): Promise<ReviewResult> {
    const { pageName, browser, actualPath, baselinePath: bPath, diffPath } = candidate;

    console.log('─'.repeat(60));
    console.log(`Page:    ${pageName}`);
    console.log(`Browser: ${browser}`);
    console.log(`Baseline: ${existsSync(bPath) ? bPath : '(no baseline — new)'}`);
    console.log(`Actual:   ${actualPath}`);
    if (diffPath) console.log(`Diff:     ${diffPath}`);
    console.log('');

    // Open images in default viewer (macOS: open, Linux: xdg-open)
    openImages([bPath, actualPath, diffPath].filter(Boolean) as string[]);

    const decision = await promptDecision(pageName, browser);

    if (decision === 'approve') {
        copyFileSync(actualPath, bPath);
        console.log(`✅ Approved — baseline updated: ${basename(bPath)}\n`);
    } else if (decision === 'reject') {
        console.log(`❌ Rejected — baseline preserved: ${basename(bPath)}\n`);
    } else {
        console.log(`⏭  Skipped — no changes made.\n`);
    }

    return { pageName, browser, decision, baselinePath: bPath };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function promptDecision(pageName: string, browser: string): Promise<ReviewDecision> {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });

        rl.question(
            `  [A]pprove  [R]eject  [S]kip  →  ${pageName} (${browser}): `,
            (answer) => {
                rl.close();
                const key = answer.trim().toLowerCase();
                if (key === 'a' || key === 'approve') return resolve('approve');
                if (key === 'r' || key === 'reject') return resolve('reject');
                resolve('skip'); // Default to skip for any other input
            }
        );
    });
}

// ---------------------------------------------------------------------------
// Image opener (macOS / Linux)
// ---------------------------------------------------------------------------

function openImages(paths: string[]): void {
    const existing = paths.filter(existsSync);
    if (existing.length === 0) return;

    try {
        const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        for (const p of existing) {
            execSync(`${cmd} "${p}"`, { stdio: 'ignore' });
        }
    } catch {
        // Non-fatal — user can navigate to paths listed in the console output
        console.warn('[DiffReviewer] Could not auto-open images. Review paths listed above.');
    }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary(results: ReviewResult[]): void {
    const approved = results.filter((r) => r.decision === 'approve').length;
    const rejected = results.filter((r) => r.decision === 'reject').length;
    const skipped = results.filter((r) => r.decision === 'skip').length;

    console.log('─'.repeat(60));
    console.log(`[DiffReviewer] Review complete:`);
    console.log(`  Approved: ${approved}  |  Rejected: ${rejected}  |  Skipped: ${skipped}`);

    if (approved > 0) {
        console.log(`\n  Baselines updated. Stage and commit baselines/ to Git:`);
        console.log(`  git add baselines/ && git commit -m "chore: update visual baselines"`);
    }
    console.log('');
}

// ---------------------------------------------------------------------------
// CLI entry (called via npm run update-baselines → diff-reviewer)
// ---------------------------------------------------------------------------

if (require.main === module) {
    runDiffReviewer().catch((err: unknown) => {
        console.error('[DiffReviewer] Fatal error:', err);
        process.exit(1);
    });
}
