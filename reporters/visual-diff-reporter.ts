import type {
    Reporter,
    FullConfig,
    Suite,
    TestCase,
    TestResult,
    FullResult,
} from '@playwright/test/reporter';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { TrendHistory, TrendRun, TrendResult } from '../utils/trend-writer';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPORTS_DIR = resolve(__dirname, '../reports');
const DIFF_REPORT_PATH = resolve(REPORTS_DIR, 'diff-report.html');
const HISTORY_PATH = resolve(REPORTS_DIR, 'history.json');

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

    onBegin(_config: FullConfig, _suite: Suite): void {
        this.failedTests = [];
        this.trendResults = [];
        this.runTimestamp = new Date().toISOString();

        mkdirSync(REPORTS_DIR, { recursive: true });
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const pageName = test.title;
        const browser = test.parent?.project()?.name ?? 'unknown';
        const status = result.status === 'passed' ? 'pass' : 'fail';

        // Accumulate trend data
        this.trendResults.push({
            page: pageName,
            browser,
            status,
            diffPixelRatio: 0, // Not directly available from TestResult; kept for schema completeness
            durationMs: result.duration,
        });

        // Collect failed test attachment paths for diff panel
        if (result.status !== 'passed') {
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
        this.updateTrendHistory();
    }

    // ---------------------------------------------------------------------------
    // Diff panel HTML generation
    // ---------------------------------------------------------------------------

    private writeDiffReport(): void {
        if (this.failedTests.length === 0) {
            // Write a minimal "all passed" report
            const html = this.buildHtml([], true);
            writeFileSync(DIFF_REPORT_PATH, html);
            return;
        }

        const html = this.buildHtml(this.failedTests, false);
        writeFileSync(DIFF_REPORT_PATH, html);
        console.log(`\n[VisualDiffReporter] Diff report written → ${DIFF_REPORT_PATH}`);
    }

    private buildHtml(failures: FailedTest[], allPassed: boolean): string {
        const imageSection = failures
            .map((f) => {
                const baseline = this.imgTag(f.baselineAttachment, 'Baseline');
                const actual = this.imgTag(f.actualAttachment, 'Actual');
                const diff = this.imgTag(f.diffAttachment, 'Diff');

                return `
      <section class="test-block fail">
        <h2>${f.pageName} <span class="browser">${f.browser}</span></h2>
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
            ? '<section class="all-passed"><h2>✅ All visual tests passed — no diffs detected.</h2></section>'
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
  <p class="meta">Generated: ${this.runTimestamp} | Failures: ${failures.length}</p>
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
    // Trend history update
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

        if (process.env['DEBUG'] === 'true') {
            console.debug(`[VisualDiffReporter] Trend history updated → ${HISTORY_PATH}`);
        }
    }
}

export default VisualDiffReporter;
