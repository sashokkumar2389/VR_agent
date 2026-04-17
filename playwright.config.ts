import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    snapshotDir: './baselines',
    // Stores baselines at: baselines/{projectName}/{pageName}.png
    snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}{ext}',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 2,
    workers: 2,
    timeout: 60000,

    reporter: [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'reports/results.json' }],
        ['./reporters/visual-diff-reporter.ts'],
    ],

    use: {
        viewport: { width: 1920, height: 1080 },
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        actionTimeout: 30000,
        navigationTimeout: 45000,
    },

    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.005,
            animations: 'disabled',
        },
    },

    globalSetup: './mcp/global-setup.ts',
    globalTeardown: './mcp/global-teardown.ts',

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
    ],
});
