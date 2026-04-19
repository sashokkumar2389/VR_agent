import type {
    Reporter,
    FullConfig,
    Suite,
    TestCase,
    TestResult,
    FullResult,
} from '@playwright/test/reporter';
import {
    writeFileSync,
    readFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    symlinkSync,
    lstatSync,
    unlinkSync,
    copyFileSync,
} from 'fs';
import { resolve, relative } from 'path';
import { TrendHistory, TrendRun, TrendResult } from '../utils/trend-writer';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPORTS_DIR = resolve(__dirname, '../reports');
const RUNS_DIR = resolve(REPORTS_DIR, 'runs');
const LATEST_LINK = resolve(REPORTS_DIR, 'latest');
const HISTORY_PATH = resolve(REPORTS_DIR, 'history.json');
const INDEX_PATH = resolve(REPORTS_DIR, 'index.html');

/** Max archived runs to keep. Older runs are pruned automatically. */
const MAX_RUNS = 10;

// ---------------------------------------------------------------------------
// Internal state collected during the run
// ---------------------------------------------------------------------------

interface FailedTest {
    pageName: string;
    browser: string;
    baselineAttachment: string | null;
    actualAttachment: string | null;
    diffAttachment: string | null;
    durationMs: number;
}

// ---------------------------------------------------------------------------
// Reporter implementation
// ---------------------------------------------------------------------------

class VisualDiffReporter implements Reporter {
    private failedTests: FailedTest[] = [];
    private trendResults: TrendResult[] = [];
    private runTimestamp = new Date().toISOString();
    /** Filesystem-safe timestamp used as run folder name, e.g. 2026-04-19_10-30-15 */
    private runDirName = '';
    /** Absolute path to this run's archive folder */
    private runDir = '';
    private totalTests = 0;
    private passedTests = 0;

    onBegin(_config: FullConfig, _suite: Suite): void {
        this.failedTests = [];
        this.trendResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.runTimestamp = new Date().toISOString();

        // Filesystem-safe: 2026-04-19_10-30-15
        this.runDirName = this.runTimestamp
            .replace(/T/, '_')
            .replace(/:/g, '-')
            .replace(/\.\d+Z$/, '');

        this.runDir = resolve(RUNS_DIR, this.runDirName);

        mkdirSync(REPORTS_DIR, { recursive: true });
        mkdirSync(this.runDir, { recursive: true });

        // Expose the run directory so playwright.config.ts reporters can use it
        process.env['VR_RUN_DIR'] = this.runDir;
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const pageName = test.title;
        const browser = test.parent?.project()?.name ?? 'unknown';
        const passed = result.status === 'passed';
        const status = passed ? 'pass' : 'fail';

        this.totalTests++;
        if (passed) this.passedTests++;

        // Accumulate trend data
        this.trendResults.push({
            page: pageName,
            browser,
            status,
            diffPixelRatio: 0,
            durationMs: result.duration,
        });

        // Collect failed test attachment paths for diff panel
        if (!passed) {
            const findAttachment = (suffix: string): string | null => {
                const attachment = result.attachments.find(
                    (a) => a.name.includes(suffix) && a.path != null
                );
                return attachment?.path ?? null;
            };

            this.failedTests.push({
                pageName,
                browser,
                baselineAttachment: findAttachment('expected'),
                actualAttachment: findAttachment('actual'),
                diffAttachment: findAttachment('diff'),
                durationMs: result.duration,
            });
        }
    }

    onEnd(_result: FullResult): void {
        this.writeDiffReport();
        this.copyResultsJson();
        this.updateTrendHistory();
        this.updateLatestSymlink();
        this.pruneOldRuns();
        this.writeRunIndex();

        console.log(`\n[VisualDiffReporter] Run archived → ${this.runDir}`);
        console.log(`[VisualDiffReporter] Latest link  → reports/latest/`);
    }

    // ---------------------------------------------------------------------------
    // Diff panel HTML generation — writes into run folder
    // ---------------------------------------------------------------------------

    private writeDiffReport(): void {
        const reportPath = resolve(this.runDir, 'diff-report.html');
        const html = this.buildDiffHtml(this.failedTests, this.failedTests.length === 0);
        writeFileSync(reportPath, html);

        if (this.failedTests.length > 0) {
            console.log(`\n[VisualDiffReporter] Diff report → ${reportPath}`);
        }
    }

    private buildDiffHtml(failures: FailedTest[], allPassed: boolean): string {
        const imageSection = failures
            .map((f) => {
                const baseline = this.imgTag(f.baselineAttachment, 'Baseline');
                const actual = this.imgTag(f.actualAttachment, 'Actual');
                const diff = this.imgTag(f.diffAttachment, 'Diff');

                return `
      <section class="test-block fail">
        <h2>${this.escapeHtml(f.pageName)} <span class="browser">${this.escapeHtml(f.browser)}</span></h2>
        <p class="duration">Duration: ${(f.durationMs / 1000).toFixed(2)}s</p>
        <div class="image-row">
          ${baseline}
          ${actual}
          ${diff}
        </div>
      </section>`;
            })
            .join('\n');

        const body = allPassed
            ? '<section class="all-passed"><h2>All visual tests passed — no diffs detected.</h2></section>'
            : imageSection;

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VR_agent — Visual Diff Report</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; margin: 0; padding: 2rem; }
    h1 { color: #f5f5f5; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    .meta { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }
    .test-block { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
    .test-block.fail { border-left: 4px solid #e74c3c; }
    .all-passed { background: #1a2d1a; border: 2px solid #2ecc71; border-radius: 8px; padding: 2rem; text-align: center; }
    h2 { margin: 0 0 0.5rem; font-size: 1.2rem; }
    .browser { background: #333; border-radius: 4px; padding: 2px 8px; font-size: 0.8rem; font-weight: normal; margin-left: 0.5rem; }
    .duration { color: #888; font-size: 0.8rem; margin: 0 0 1rem; }
    .image-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .image-cell { text-align: center; }
    .image-cell label { display: block; font-size: 0.75rem; color: #aaa; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .image-cell img { width: 100%; border: 1px solid #444; border-radius: 4px; }
    .image-cell .no-image { padding: 2rem; background: #111; border: 1px dashed #444; border-radius: 4px; color: #555; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>VR_agent — Visual Diff Report</h1>
  <p class="meta">Generated: ${this.escapeHtml(this.runTimestamp)} | Failures: ${failures.length}</p>
  ${body}
</body>
</html>`;
    }

    private imgTag(filePath: string | null, label: string): string {
        if (!filePath || !existsSync(filePath)) {
            return `<div class="image-cell"><label>${label}</label><div class="no-image">not available</div></div>`;
        }

        const data = readFileSync(filePath).toString('base64');
        return `<div class="image-cell">
      <label>${label}</label>
      <img src="data:image/png;base64,${data}" alt="${label}" />
    </div>`;
    }

    // ---------------------------------------------------------------------------
    // Copy Playwright results.json into the run folder
    // ---------------------------------------------------------------------------

    private copyResultsJson(): void {
        const src = resolve(REPORTS_DIR, 'results.json');
        if (existsSync(src)) {
            copyFileSync(src, resolve(this.runDir, 'results.json'));
        }
    }

    // ---------------------------------------------------------------------------
    // Trend history update (cumulative)
    // ---------------------------------------------------------------------------

    private updateTrendHistory(): void {
        const history: TrendHistory = existsSync(HISTORY_PATH)
            ? (JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) as TrendHistory)
            : { runs: [] };

        const run: TrendRun = {
            timestamp: this.runTimestamp,
            results: this.trendResults,
        };

        history.runs.push(run);
        writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    }

    // ---------------------------------------------------------------------------
    // Symlink: reports/latest → runs/<timestamp>
    // ---------------------------------------------------------------------------

    private updateLatestSymlink(): void {
        try {
            if (existsSync(LATEST_LINK)) {
                // lstat follows the link itself, not the target
                if (lstatSync(LATEST_LINK).isSymbolicLink()) {
                    unlinkSync(LATEST_LINK);
                } else {
                    rmSync(LATEST_LINK, { recursive: true, force: true });
                }
            }
            // Relative symlink so it works when the repo is moved
            const target = relative(REPORTS_DIR, this.runDir);
            symlinkSync(target, LATEST_LINK);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[VisualDiffReporter] Could not create latest symlink: ${msg}`);
        }
    }

    // ---------------------------------------------------------------------------
    // Auto-prune: keep only the last MAX_RUNS archived runs
    // ---------------------------------------------------------------------------

    private pruneOldRuns(): void {
        if (!existsSync(RUNS_DIR)) return;

        const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort(); // Lexicographic sort = chronological (timestamp format)

        if (dirs.length <= MAX_RUNS) return;

        const toRemove = dirs.slice(0, dirs.length - MAX_RUNS);
        for (const dir of toRemove) {
            rmSync(resolve(RUNS_DIR, dir), { recursive: true, force: true });
        }

        console.log(`[VisualDiffReporter] Pruned ${toRemove.length} old run(s), keeping last ${MAX_RUNS}`);
    }

    // ---------------------------------------------------------------------------
    // Run index: reports/index.html — lists all archived runs
    // ---------------------------------------------------------------------------

    private writeRunIndex(): void {
        if (!existsSync(RUNS_DIR)) return;

        const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort()
            .reverse(); // Most recent first

        // Read history.json to get pass/fail counts per run
        const history: TrendHistory = existsSync(HISTORY_PATH)
            ? (JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) as TrendHistory)
            : { runs: [] };

        const rows = dirs.map((dir) => {
            // Parse timestamp back from folder name: 2026-04-19_10-30-15 → 2026-04-19T10:30:15Z
            const iso = dir.replace(/_/, 'T').replace(/-(\d{2})-(\d{2})$/, ':$1:$2Z');
            const trendRun = history.runs.find((r) => r.timestamp.startsWith(iso.slice(0, 19)));

            const total = trendRun?.results.length ?? 0;
            const passed = trendRun?.results.filter((r) => r.status === 'pass').length ?? 0;
            const failed = total - passed;
            const badge = failed > 0
                ? `<span class="badge fail">${failed} failed</span>`
                : `<span class="badge pass">all passed</span>`;

            const diffLink = `<a href="runs/${dir}/diff-report.html">Diff Report</a>`;
            const jsonLink = existsSync(resolve(RUNS_DIR, dir, 'results.json'))
                ? ` | <a href="runs/${dir}/results.json">JSON</a>`
                : '';

            return `<tr>
        <td class="ts">${this.escapeHtml(dir)}</td>
        <td>${badge}</td>
        <td>${passed}/${total}</td>
        <td>${diffLink}${jsonLink}</td>
      </tr>`;
        }).join('\n');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VR_agent — Run History</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; margin: 0; padding: 2rem; }
    h1 { color: #f5f5f5; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th { text-align: left; color: #aaa; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.5rem 1rem; border-bottom: 1px solid #333; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #1a1a1a; }
    tr:hover { background: #1a1a1a; }
    .ts { font-family: monospace; font-size: 0.9rem; }
    .badge { padding: 2px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
    .badge.pass { background: #1a3d1a; color: #2ecc71; }
    .badge.fail { background: #3d1a1a; color: #e74c3c; }
    a { color: #5dade2; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>VR_agent — Run History</h1>
  <p class="subtitle">Last ${dirs.length} run(s) archived. Auto-pruned to ${MAX_RUNS} most recent.</p>
  <table>
    <thead>
      <tr><th>Run</th><th>Status</th><th>Passed</th><th>Reports</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

        writeFileSync(INDEX_PATH, html);
    }

    // ---------------------------------------------------------------------------
    // Utility
    // ---------------------------------------------------------------------------

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

export default VisualDiffReporter;
