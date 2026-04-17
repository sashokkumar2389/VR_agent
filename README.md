# VR_agent — Visual Regression Testing Agent

AI-powered visual regression testing for 6 KPMG public pages using **Playwright** and **Playwright MCP**.

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
# 1. Install dependencies
npm install
npx playwright install chromium firefox

# 2. Generate baselines (first run)
npm run update-baselines

# 3. Run visual regression tests
npm test

# 4. Open HTML report
npm run report
```

## Coverage Matrix

| Page | Chromium | Firefox | Threshold |
|------|----------|---------|-----------|
| Homepage | ✓ | ✓ | 0.8% |
| Industries | ✓ | ✓ | 0.5% |
| Services | ✓ | ✓ | 0.3% |
| Insights | ✓ | ✓ | 0.5% |
| Careers | ✓ | ✓ | 0.5% |
| Job Search | ✓ | ✓ | 1.0% |

12 screenshots total (6 pages × 2 browsers × 1 viewport).

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run all visual regression tests |
| `npm run test:chromium` | Chromium only |
| `npm run test:firefox` | Firefox only |
| `npm run update-baselines` | Regenerate all baselines (human approval required) |
| `npm run report` | Open Playwright HTML report |
| `npm run typecheck` | TypeScript type check with zero errors |

## Debug Mode

```bash
DEBUG=true npm test    # Prints MCP prompts and stabilization steps
```

## Baseline Management

Baselines are committed to Git under `baselines/chromium/` and `baselines/firefox/`.

To update baselines after intentional UI changes:

```bash
npm run update-baselines
# Follow the interactive Approve/Reject/Skip prompt per changed screenshot
```

## Project Structure

```
├── config/            # pages.config.json + global.config.ts
├── tests/visual/      # Data-driven visual.spec.ts
├── utils/             # page-stabilizer, screenshot-helper, diff-reviewer, logger
├── mcp/               # MCP client, orchestrator, prompt templates
├── baselines/         # Stored baseline PNGs (committed to Git)
├── reports/           # history.json (committed); generated reports (gitignored)
├── reporters/         # Custom Playwright reporter with diff panel
└── docs/              # ARCHITECTURE.md, SPRINT_PLAN.md
```

## Phase 0 Success Criterion

Run `npm test` twice consecutively with no code or content changes. Both runs must report **12 passed, 0 failed, 0 diffs**.
