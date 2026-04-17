import { Page } from '@playwright/test';
import { PageConfig, getGlobalDefaults } from '../config/global.config';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StabilizationLevel = 'standard' | 'extended' | 'maximum';

// ---------------------------------------------------------------------------
// Stabilization entry point
// ---------------------------------------------------------------------------

/**
 * Brings a page to a consistent, deterministic state ready for screenshot capture.
 *
 * Level matrix (from ARCHITECTURE.md §12.1):
 *   standard  — 1× timeout, networkidle, disable animations, lazy scroll
 *   extended  — 1.5× timeout, + wait for all <img>, re-dismiss overlays, 2s settle
 *   maximum   — 2× timeout,  + force CSS injection, 5s hard settle, re-scroll
 */
export async function stabilizePage(
  page: Page,
  config: PageConfig,
  level: StabilizationLevel = 'standard'
): Promise<void> {
  const { timeout } = getGlobalDefaults();
  const effectiveTimeout = resolveTimeout(timeout, level);

  logger.debug('PageStabilizer', `Stabilizing "${config.name}"`, { level, timeoutMs: effectiveTimeout });

  // Step 1 — Wait for network idle
  await page.waitForLoadState('networkidle', { timeout: effectiveTimeout });
  logger.debug('PageStabilizer', 'networkidle reached', { page: config.name });

  // Step 2 — Disable CSS animations and transitions
  await disableAnimations(page, level);

  // Step 3 — Extended: wait for all images to load
  if (level === 'extended' || level === 'maximum') {
    await waitForAllImages(page, effectiveTimeout);
    logger.debug('PageStabilizer', 'All images loaded', { page: config.name });
  }

  // Step 4 — Scroll to bottom to trigger lazy-loaded content
  await scrollToBottom(page);
  logger.debug('PageStabilizer', 'Lazy scroll complete', { page: config.name });

  // Step 5 — Execute page-specific wait conditions
  for (const condition of config.waitConditions) {
    await page.waitForSelector(condition, { state: 'visible', timeout: effectiveTimeout });
    logger.debug('PageStabilizer', `Wait condition met: ${condition}`, { page: config.name });
  }

  // Step 6 — Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

  // Step 7 — Hard settle delay
  const settleMs = resolveSettleDelay(level);
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs);
  }

  logger.info('PageStabilizer', `"${config.name}" stabilized`, { level, settleMs });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function resolveTimeout(base: number, level: StabilizationLevel): number {
  switch (level) {
    case 'extended': return Math.round(base * 1.5);
    case 'maximum': return base * 2;
    default: return base;
  }
}

function resolveSettleDelay(level: StabilizationLevel): number {
  switch (level) {
    case 'extended': return 2000;
    case 'maximum': return 5000;
    default: return 0;
  }
}

async function disableAnimations(page: Page, level: StabilizationLevel): Promise<void> {
  // Standard: use Playwright's built-in animation disabling via CSS addStyleTag
  // Maximum: also force-inject a stronger override to catch dynamically added elements
  const css =
    level === 'maximum'
      ? `*, *::before, *::after {
           animation-duration: 0s !important;
           animation-delay: 0s !important;
           transition-duration: 0s !important;
           transition-delay: 0s !important;
           scroll-behavior: auto !important;
         }`
      : `*, *::before, *::after {
           animation-duration: 0.001s !important;
           transition-duration: 0.001s !important;
         }`;

  await page.addStyleTag({ content: css });
}

async function waitForAllImages(page: Page, timeout: number): Promise<void> {
  await page.waitForFunction(
    () => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.every((img) => img.complete && img.naturalWidth > 0);
    },
    { timeout }
  );
}

async function scrollToBottom(page: Page): Promise<void> {
  // Incrementally scroll to trigger IntersectionObserver-based lazy loaders
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const distance = 300;
      const delay = 80; // ms between scrolls
      let scrolled = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrolled += distance;
        if (scrolled >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });

  // Brief pause after reaching the bottom
  await page.waitForTimeout(500);
}
