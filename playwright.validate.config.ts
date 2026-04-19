import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Validation-specific config — inherits from the main config but:
 *   - Targets only tests/validation/
 *   - Removes testIgnore so the validation suite is discovered
 *   - Disables retries (determinism check should pass first try)
 */
export default defineConfig({
    ...baseConfig,
    testDir: './tests/validation',
    testIgnore: [],
    retries: 0,
    globalSetup: undefined,
    globalTeardown: undefined,
});
