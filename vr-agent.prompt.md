---
mode: agent
description: Visual Regression Testing Agent — phased implementation driver for the VR_agent project (Playwright + MCP)
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - run_in_terminal
  - file_search
  - grep_search
---

# Visual Regression Testing Agent — Copilot Agent Prompt

> **Project:** VR_agent — AI-powered Visual Regression Testing Framework  
> **Stack:** TypeScript · Playwright · Playwright MCP  
> **Target:** 6 KPMG public pages × 2 browsers × 1 viewport = 12 baselines  
> **Rule:** Ask for human confirmation before implementing each sprint.

---

## Agent Behaviour Contract

1. **Read** `docs/ARCHITECTURE.md` at the start of every session to load full context.
2. **Announce** the current sprint goal, list its deliverables, and **wait for approval** before writing any code.
3. **Implement** only what is listed for the approved sprint — no scope creep.
4. **Verify** each file compiles (`npx tsc --noEmit`) before moving on.
5. **Report** completed deliverables with file links after each sprint.
6. **Pause** and ask: *"Sprint N is complete. Shall I proceed to Sprint N+1?"*

---

## Project Context (loaded from ARCHITECTURE.md)

### Target Pages
| # | Name | URL | Threshold |
|---|------|-----|-----------|
| 1 | homepage | `https://kpmg.com/xx/en.html` | 0.8% |
| 2 | industries | `https://kpmg.com/xx/en/what-we-do/industries.html` | 0.5% |
| 3 | services | `https://kpmg.com/xx/en/what-we-do/services.html` | 0.3% |
| 4 | insights | `https://kpmg.com/xx/en/insights.html` | 0.5% |
| 5 | careers | `https://kpmg.com/xx/en/careers.html` | 0.5% |
| 6 | careers-job-search | `https://kpmg.com/xx/en/careers/job-search.html` | 1.0% |

### Execution Model
- 2 workers (Chromium + Firefox in parallel)
- Sequential pages within each browser
- `fullyParallel: false`, `retries: 2`
- Viewport: **1920×1080** desktop only

---

## Canonical Folder Structure

```
VR_agent/
├── docs/
│   ├── ARCHITECTURE.md
│   └── SPRINT_PLAN.md
├── config/
│   ├── pages.config.json
│   └── global.config.ts
├── tests/
│   └── visual/
│       └── visual.spec.ts
├── utils/
│   ├── page-stabilizer.ts
│   ├── screenshot-helper.ts
│   └── diff-reviewer.ts
├── mcp/
│   ├── mcp-client.ts
│   ├── mcp-orchestrator.ts
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   └── prompts/
│       ├── navigate-and-stabilize.prompt.md
│       ├── capture-screenshot.prompt.md
│       └── compare-and-report.prompt.md
├── baselines/
│   ├── chromium/
│   └── firefox/
├── reports/
│   └── history.json
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## Sprint 1 — Foundation

**Goal:** Project scaffolding — all config, tooling, and documentation in place. No test logic yet.

### Deliverables
| File | Description |
|------|-------------|
| `package.json` | Dependencies: `@playwright/test ^1.50`, `@playwright/mcp ^0.0.30`, `typescript ^5.5` |
| `tsconfig.json` | Strict TypeScript, `ES2022` target, `NodeNext` modules |
| `playwright.config.ts` | 2 projects (chromium/firefox), workers=2, global setup/teardown wired |
| `config/pages.config.json` | All 6 KPMG pages with per-page threshold + mcpInstructions |
| `config/global.config.ts` | `PageConfig`, `GlobalDefaults`, `PagesConfiguration` interfaces + loader functions |
| `.gitignore` | Ignore `node_modules/`, `playwright-report/`, `test-results/`, `reports/` (except `history.json`) |
| `README.md` | Quick-start guide: install, run, update baselines |
| `docs/SPRINT_PLAN.md` | Living sprint tracker |

### Acceptance Criteria
- `npm install` succeeds
- `npx tsc --noEmit` passes with zero errors
- `config/global.config.ts` exports `getPageConfigs()`, `getPageConfig()`, `getGlobalDefaults()`

---

## Sprint 2 — MCP Integration

**Goal:** Wire up the MCP server lifecycle, orchestration logic, prompt templates, and page stabilizer.

### Deliverables
| File | Description |
|------|-------------|
| `mcp/mcp-client.ts` | `MCPClient` class: `initialize()`, `sendPrompt()`, `shutdown()`, `isConnected()` |
| `mcp/mcp-orchestrator.ts` | `orchestratePageTest()`, `loadPromptTemplate()`, `executeNavigation()`, `executeStabilization()`, `executeCookieDismissal()` |
| `mcp/global-setup.ts` | Playwright globalSetup — starts MCP server, stores connection in global state |
| `mcp/global-teardown.ts` | Playwright globalTeardown — graceful MCP shutdown, finalise trend log |
| `mcp/prompts/navigate-and-stabilize.prompt.md` | Template with `{{url}}` and `{{mcpInstructions}}` |
| `mcp/prompts/capture-screenshot.prompt.md` | Template for scroll-then-capture sequence |
| `mcp/prompts/compare-and-report.prompt.md` | Template for comparison result reporting |
| `utils/page-stabilizer.ts` | `stabilizePage(page, config, level)` with 3 progressive levels |

### Acceptance Criteria
- `npx tsc --noEmit` passes
- `globalSetup` boots MCP server without throwing
- `PageStabilizer` exports `stabilizePage` with `'standard' | 'extended' | 'maximum'` level type

### Key Implementation Notes
- MCP server started via `@playwright/mcp` CLI (`npx @playwright/mcp --config ...`)
- `MCPClient` stores PID / port in a temp file so globalTeardown can clean up
- Prompt templates use `{{variable}}` placeholders replaced via `loadPromptTemplate()`
- Progressive stabilization levels defined in `ARCHITECTURE.md §12.1`

---

## Sprint 3 — Screenshot Engine

**Goal:** Full capture-compare-baseline workflow with data-driven test spec.

### Deliverables
| File | Description |
|------|-------------|
| `utils/screenshot-helper.ts` | `captureFullPage()`, `compareWithBaseline()`, `generateDiffOverlay()`, `saveBaseline()` |
| `tests/visual/visual.spec.ts` | Data-driven spec: iterates `getPageConfigs()`, orchestrates via MCP, asserts via `toHaveScreenshot()` |
| `baselines/chromium/` | Directory created (initially empty, populated on first baseline run) |
| `baselines/firefox/` | Directory created (initially empty, populated on first baseline run) |

### Acceptance Criteria
- `npx tsc --noEmit` passes
- `npm run update-baselines` generates 12 PNG files (6 pages × 2 browsers)
- Second run of `npm test` produces zero diffs when no page changes have occurred

### Key Implementation Notes
- `captureFullPage` applies `maskSelectors` from page config using Playwright's `mask` option
- `compareWithBaseline` uses `maxDiffPixelRatio` from page config
- Baseline path convention: `baselines/{browser}/{pageName}.png`
- Test spec uses `test.describe` per browser project, `test` per page

---

## Sprint 4 — Reporting

**Goal:** Interactive diff reviewer, custom Playwright reporter, trend tracking.

### Deliverables
| File | Description |
|------|-------------|
| `utils/diff-reviewer.ts` | Interactive CLI: shows baseline/actual/diff side-by-side, prompts `[A]pprove / [R]eject / [S]kip` |
| `reporters/visual-diff-reporter.ts` | Custom Playwright reporter with diff panel + trend tracker |
| `reports/history.json` | Initial schema: `{ runs: [] }` |

### Acceptance Criteria
- `npm run update-baselines` triggers `diff-reviewer.ts` for each changed screenshot
- Custom reporter generates `reports/diff-report.html` after each run
- `reports/history.json` records pass/fail per page per browser per run

### Key Implementation Notes
- `diff-reviewer.ts` opens diff images in the terminal via `open` command (macOS) or writes paths to stdout
- Trend history schema defined in `ARCHITECTURE.md §7.7`
- Custom reporter implements Playwright's `Reporter` interface
- Diff panel is a self-contained HTML file with inline base64 images

---

## Sprint 5 — Resilience & Validation

**Goal:** Smart progressive retry, structured logging, trace integration, end-to-end zero-diff validation.

### Deliverables
| File | Description |
|------|-------------|
| `utils/logger.ts` | Structured logger: `INFO`, `DEBUG`, `WARN`, `ERROR`; `DEBUG=true` env flag |
| `utils/page-stabilizer.ts` (update) | Integrate logger; complete progressive retry matrix from `ARCHITECTURE.md §12.1` |
| `mcp/mcp-orchestrator.ts` (update) | Log every MCP prompt/response with timestamp + duration |
| `tests/visual/visual.spec.ts` (update) | Wire retry levels to Playwright's `retries` count |
| `tests/validation/zero-diff.spec.ts` | Runs suite twice, asserts zero diffs on second pass |

### Acceptance Criteria
- `npm test` runs all 12 visual tests end-to-end with no errors
- `npm test` run twice consecutively → zero diffs on second run (Phase 0 success criterion)
- `DEBUG=true npm test` prints MCP prompts and stabilization steps to stdout
- Trace file generated in `test-results/` on first retry

---

## MCP Prompt Template Reference

### navigate-and-stabilize.prompt.md
```
Navigate to {{url}} and perform the following:
1. Wait for the page to fully load (all network requests settled)
2. Look for any cookie consent banner or GDPR popup
3. If a cookie banner is found, click "Reject All" or "Essential Only" or "Decline"
4. Wait for the banner to fully disappear
5. Confirm the page is now free of overlays and modals

{{mcpInstructions}}
```

### capture-screenshot.prompt.md
```
The page at {{url}} is now stable. Perform the following:
1. Scroll slowly to the bottom of the page to trigger any lazy-loaded content
2. Wait 2 seconds for lazy content to render
3. Scroll back to the top of the page
4. Wait 1 second for the page to settle
5. Confirm all images and media elements are fully loaded
6. The page is now ready for screenshot capture
```

### compare-and-report.prompt.md
```
Screenshot capture for {{pageName}} on {{browser}} is complete.
Compare the captured screenshot against the stored baseline at baselines/{{browser}}/{{pageName}}.png.
Report: pass (zero diff), warn (diff within threshold {{threshold}}%), or fail (diff exceeds threshold).
```

---

## Error Handling Reference

| Error | Strategy |
|-------|----------|
| Navigation timeout | Retry with extended timeout (1.5×) |
| Cookie banner absent | Log WARNING, continue |
| MCP connection failure | Abort run, log ERROR |
| Screenshot mismatch | Progressive retry → diff report |
| MCP prompt timeout | Retry with simplified prompt |

---

## Phase 0 Success Criterion

> Run `npm test` twice consecutively with no code changes.  
> Both runs must produce **ZERO diffs** across all 12 screenshots.

```bash
npm test          # Run 1 — generates baselines if absent
npm test          # Run 2 — must show 12 passed, 0 failed, 0 diffs
```
