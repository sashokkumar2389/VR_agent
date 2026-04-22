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
| `npm run test:validate` | Run zero-diff validation suite (Phase 0 check) |
| `npm run update-baselines` | Regenerate all baselines (human approval required) |
| `npm run diff-review` | Standalone interactive diff-review without re-running tests |
| `npm run report` | Open Playwright HTML report for the latest run |
| `npm run report:index` | Open aggregated multi-run index report |
| `npm run typecheck` | TypeScript type check with zero errors |
| `npm run lint` | Alias for typecheck |

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
├── config/                  # pages.config.json + global.config.ts
├── tests/
│   ├── visual/              # Data-driven visual.spec.ts
│   └── validation/          # zero-diff.spec.ts (Phase 0 determinism check)
├── utils/                   # page-stabilizer, screenshot-helper, diff-reviewer, trend-writer, logger
├── mcp/
│   ├── mcp-client.ts        # Playwright MCP connection helpers
│   ├── mcp-orchestrator.ts  # Orchestrates navigation + cookie dismissal per test
│   ├── global-setup.ts      # Run-level setup hook
│   ├── global-teardown.ts   # Run-level teardown hook
│   └── prompts/             # Prompt templates (.prompt.md) for MCP tools
├── baselines/               # Stored baseline PNGs — chromium/ and firefox/ (committed to Git)
├── reports/
│   ├── history.json         # Trend history across all runs (committed)
│   ├── index.html           # Aggregated multi-run report
│   ├── latest -> runs/<ts>/ # Symlink to most recent run (gitignored)
│   └── runs/                # Archived run folders, auto-pruned at 10 (gitignored)
├── reporters/               # visual-diff-reporter.ts — custom reporter with diff panel + trend tracking
├── vr-agent.prompt.md       # Root-level agent prompt
└── docs/                    # ARCHITECTURE.md, SPRINT_PLAN.md
```

## Phase 0 Success Criterion

Run `npm test` twice consecutively with no code or content changes. Both runs must report **12 passed, 0 failed, 0 diffs**.
