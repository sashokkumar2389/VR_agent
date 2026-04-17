import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface TrendResult {
    page: string;
    browser: string;
    status: 'pass' | 'fail';
    diffPixelRatio: number;
    durationMs: number;
}

export interface TrendRun {
    timestamp: string;
    results: TrendResult[];
}

export interface TrendHistory {
    runs: TrendRun[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const HISTORY_PATH = resolve(__dirname, '../reports/history.json');
const RESULTS_PATH = resolve(__dirname, '../reports/results.json');

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Reads the latest Playwright results.json and appends a new entry to history.json.
 * Called from globalTeardown after all tests complete.
 */
export async function appendTrendEntry(): Promise<void> {
    if (!existsSync(RESULTS_PATH)) {
        console.warn('[TrendWriter] results.json not found — skipping trend update.');
        return;
    }

    const raw = readFileSync(RESULTS_PATH, 'utf-8');
    const playwrightResults = JSON.parse(raw) as PlaywrightResultsJson;

    const results: TrendResult[] = [];

    for (const suite of playwrightResults.suites ?? []) {
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                const status = test.status === 'passed' ? 'pass' : 'fail';
                results.push({
                    page: spec.title,
                    browser: test.projectName ?? 'unknown',
                    status,
                    diffPixelRatio: 0, // Playwright does not expose this in results.json
                    durationMs: test.results?.[0]?.duration ?? 0,
                });
            }
        }
    }

    const history: TrendHistory = existsSync(HISTORY_PATH)
        ? (JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) as TrendHistory)
        : { runs: [] };

    history.runs.push({
        timestamp: new Date().toISOString(),
        results,
    });

    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// ---------------------------------------------------------------------------
// Minimal Playwright results.json shape
// ---------------------------------------------------------------------------

interface PlaywrightResultsJson {
    suites?: Array<{
        specs?: Array<{
            title: string;
            tests?: Array<{
                status: string;
                projectName?: string;
                results?: Array<{ duration: number }>;
            }>;
        }>;
    }>;
}
