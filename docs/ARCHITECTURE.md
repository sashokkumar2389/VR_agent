# 🏗️ Visual Regression Testing Agent — Phase 0 Architecture Document

> **Project:** VR_agent — Visual Regression Testing Agent using Playwright MCP  
> **Repository:** [sashokkumar2389/VR_agent](https://github.com/sashokkumar2389/VR_agent)  
> **Phase:** 0 (Foundation)  
> **Date:** 2026-04-12  
> **Author:** @sashokkumar2389  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Architecture Decisions (ADR)](#3-architecture-decisions-adr)
4. [System Architecture](#4-system-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Folder Structure](#6-folder-structure)
7. [Component Design](#7-component-design)
8. [Configuration Design](#8-configuration-design)
9. [MCP Integration Architecture](#9-mcp-integration-architecture)
10. [Screenshot Comparison Engine](#10-screenshot-comparison-engine)
11. [Baseline Management](#11-baseline-management)
12. [Error Handling & Retry Strategy](#12-error-handling--retry-strategy)
13. [Reporting Architecture](#13-reporting-architecture)
14. [Logging & Debugging](#14-logging--debugging)
15. [Test Execution Strategy](#15-test-execution-strategy)
16. [Sprint Roadmap](#16-sprint-roadmap)
17. [Phase 0 Success Criteria](#17-phase-0-success-criteria)
18. [Future Phases](#18-future-phases)
19. [Appendix](#19-appendix)

---

## 1. Executive Summary

The **Visual Regression Testing Agent (VR_agent)** is an AI-powered visual regression testing framework built on **Playwright** and **Playwright MCP** (Model Context Protocol). It automates the detection of unintended visual changes across **6 KPMG public web pages** by capturing full-page screenshots, comparing them against stored baselines, and generating actionable reports with visual diffs.

**Phase 0 Scope:**
- **6 pages** × **2 browsers** (Chromium, Firefox) × **1 viewport** (1920×1080) = **12 baseline screenshots**
- Local developer machine execution only
- Full test orchestration via Playwright MCP
- Interactive human-in-the-loop baseline approval workflow

---

## 2. Project Overview

### 2.1 Problem Statement

KPMG maintains a suite of public-facing web pages that must maintain visual consistency across releases and content updates. Manual visual inspection is time-consuming, error-prone, and doesn't scale. There is a need for an automated, AI-driven visual regression testing solution.

### 2.2 Solution

An automated visual regression framework that:

1. **Navigates** to each KPMG page using MCP-driven browser orchestration
2. **Stabilizes** pages by dismissing cookie banners, disabling animations, and waiting for full content load
3. **Captures** full-page screenshots across multiple browsers
4. **Compares** screenshots against stored baselines using pixel-level analysis
5. **Reports** regressions with side-by-side visual diffs and historical trend data
6. **Manages** baseline updates through an interactive human-in-the-loop approval workflow

### 2.3 Target Pages

| # | Page Name | URL | Description |
|---|-----------|-----|-------------|
| 1 | Homepage | `https://kpmg.com/xx/en.html` | Main landing page with hero carousel |
| 2 | Industries | `https://kpmg.com/xx/en/what-we-do/industries.html` | Industries overview |
| 3 | Services | `https://kpmg.com/xx/en/what-we-do/services.html` | Services listing (static content) |
| 4 | Insights | `https://kpmg.com/xx/en/insights.html` | Articles and thought leadership |
| 5 | Careers | `https://kpmg.com/xx/en/careers.html` | Careers landing page |
| 6 | Job Search | `https://kpmg.com/xx/en/careers/job-search.html` | Dynamic job listing grid |

---

## 3. Architecture Decisions (ADR)

All 20 architecture decisions were validated through a structured questionnaire process.

### ADR-001: Test Execution Environment
- **Decision:** Local developer machines only
- **Rationale:** Phase 0 focuses on proving the concept. CI/CD integration is deferred to Phase 1+.
- **Implications:** No Docker, no cloud runners, no CI pipeline configuration required.

### ADR-002: Browser Coverage
- **Decision:** Chromium + Firefox (2 browsers)
- **Rationale:** Covers the two most common rendering engines (Blink, Gecko). WebKit deferred to future phases.
- **Implications:** 2 Playwright projects configured, doubling the screenshot matrix.

### ADR-003: Viewport Sizes
- **Decision:** Desktop only (1920×1080)
- **Rationale:** KPMG pages are primarily accessed on desktop. Mobile/tablet viewports deferred.
- **Implications:** Single viewport simplifies baseline management. 12 total screenshots (6 pages × 2 browsers × 1 viewport).

### ADR-004: Screenshot Capture Strategy
- **Decision:** Full-page screenshots with optimized tolerance
- **Rationale:** Captures the complete page experience. Per-page tolerance thresholds account for varying page complexity.
- **Implications:** Larger image files; requires scroll-and-stitch logic; lazy-loaded content must be triggered.

### ADR-005: Dynamic Content Handling
- **Decision:** Dismiss overlays + mask dynamic regions (combined approach)
- **Rationale:** Cookie banners and popups are dismissed programmatically. Truly dynamic content (timestamps, ads) is masked to prevent false positives.
- **Implications:** Requires `maskSelectors` per page in config. MCP handles cookie dismissal.

### ADR-006: Baseline Storage
- **Decision:** Baselines committed directly to Git repository
- **Rationale:** Simple, versioned, and co-located with test code. 12 screenshots are manageable in Git for Phase 0.
- **Implications:** Repository size grows with baselines. Git LFS migration considered for future phases.

### ADR-007: Baseline Update Workflow
- **Decision:** Interactive approval with human-in-the-loop
- **Rationale:** Prevents accidental baseline overwrites. Developer must explicitly approve each change via a side-by-side visual diff preview.
- **Implications:** Custom `diff-reviewer.ts` utility required. Slows update process intentionally for safety.

### ADR-008: Playwright MCP Usage
- **Decision:** Full test orchestration via MCP (Option B)
- **Rationale:** MCP orchestrates the entire test lifecycle — navigation, interaction, stabilization, screenshot capture, and comparison coordination.
- **Implications:** Heavy reliance on MCP capabilities. Requires robust prompt engineering, session management, and error handling for non-deterministic AI responses.

### ADR-009: Test Data Configuration
- **Decision:** External JSON configuration file (`pages.config.json`)
- **Rationale:** Adding pages becomes a config change, not a code change. Supports per-page metadata.
- **Implications:** Framework reads config and dynamically generates test cases. Type-safe loader required.

### ADR-010: Screenshot Comparison Threshold
- **Decision:** Per-page configurable threshold with 0.5% default (`maxDiffPixelRatio: 0.005`)
- **Rationale:** Pages vary in complexity. Homepage (carousel) needs higher tolerance; Services (static) can be stricter.
- **Implications:** `maxDiffPixelRatio` property per page in config, falling back to global default.

### ADR-011: Project Folder Structure
- **Decision:** Layer-based structure (organized by responsibility)
- **Rationale:** Clear separation of concerns: config, tests, utilities, MCP logic, baselines, reports.
- **Implications:** Scales well as pages and features grow. Easy onboarding.

### ADR-012: MCP Server Configuration
- **Decision:** Embedded within test process (globalSetup / globalTeardown)
- **Rationale:** Self-contained execution. Single `npx playwright test` command handles everything.
- **Implications:** MCP server lifecycle tied to test lifecycle. Clean state every run.

### ADR-013: Test Execution Strategy
- **Decision:** Parallel by browser, sequential pages within each browser
- **Rationale:** Two browser instances run simultaneously (halving execution time). Sequential page execution within each browser avoids network contention and ensures consistent captures.
- **Implications:** Workers set to 2. `fullyParallel: false` within each project.

### ADR-014: Reporting Format
- **Decision:** Playwright HTML report + custom visual diff panel + historical trend tracking
- **Rationale:** Comprehensive debugging capability. Diff panel shows baseline vs actual vs diff overlay. Trend tracking identifies chronically unstable pages.
- **Implications:** Custom reporter plugin required. JSON-based trend log.

### ADR-015: Error Handling & Retry Strategy
- **Decision:** Smart retry with progressive stabilization (3 attempts)
- **Rationale:** Simple retries repeat same conditions. Progressive stabilization increases wait times, re-dismisses overlays, and adds hard settle delays on each successive attempt.
- **Implications:** `page-stabilizer.ts` manages escalating stabilization strategies.

### ADR-016: Authentication & Access
- **Decision:** No authentication required — all 6 pages are publicly accessible
- **Rationale:** KPMG public pages require no login, VPN, or geo-restricted access.
- **Implications:** No credential management, session handling, or proxy configuration.

### ADR-017: Cookie/GDPR Consent Handling
- **Decision:** Reject all / essential only
- **Rationale:** Minimizes tracking scripts and personalized content. Produces the cleanest, most reproducible page state.
- **Implications:** MCP instructed to find and click "Reject All" or "Essential Only" on cookie consent banners.

### ADR-018: MCP Prompt Design
- **Decision:** Template-based prompts with per-page config overrides (hybrid)
- **Rationale:** Common workflows (navigate, stabilize, capture) use reusable templates. Page-specific edge cases (pause carousel, wait for job grid) are defined in config.
- **Implications:** `mcp/prompts/` directory with `.prompt.md` templates. `mcpInstructions` field per page in config.

### ADR-019: Logging & Debugging
- **Decision:** Detailed step-by-step logging + Playwright trace files (on-first-retry)
- **Rationale:** Traces enable full browser session replay. MCP prompt/response logging critical for debugging AI agent behavior. Conditional trace capture manages file size.
- **Implications:** Logs written to `reports/`. Trace files (`.zip`) generated on failures.

### ADR-020: Phase 0 Success Criteria
- **Decision:** All 6 pages generate stable baselines — consecutive runs with no changes produce zero diffs
- **Rationale:** Proves deterministic, reproducible captures across both browsers.
- **Implications:** Validation test: run suite twice, assert zero diffs.

---

## 4. System Architecture

### 4.1 High-Level Architecture Diagram

```
┌────────────────────────────��────────────────────────────────────────┐
│                        VR_AGENT FRAMEWORK                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │    CONFIG     │    │   MCP LAYER      │    │   TEST RUNNER    │  │
│  │              │    │                  │    │                  │  │
│  │ pages.config │───▶│ MCP Client       │◀──▶│ Playwright Test  │  │
│  │ global.config│    │ MCP Orchestrator │    │ Visual Spec      │  │
│  │              │    │ Prompt Templates │    │                  │  │
│  └──────────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│                               │                       │             │
│                               ▼                       │             │
│                    ┌──────────────────┐                │             │
│                    │   BROWSER LAYER  │                │             │
│                    │                  │                │             │
│                    │ ┌──────────────┐ │                │             │
│                    │ │  Chromium    │ │                │             │
│                    │ └──────────────┘ │                │             │
│                    │ ┌──────────────┐ │                │             │
│                    │ │  Firefox     │ │                │             │
│                    │ └──────────────┘ │                │             │
│                    └────────┬─────────┘                │             │
│                             │                         │             │
│                             ▼                         ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      UTILITIES LAYER                         │   │
│  │                                                              │   │
│  │  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │ Page Stabilizer│  │  Screenshot  │  │  Diff Reviewer  │  │   │
│  │  │                │  │  Helper      │  │  (Human-in-Loop)│  │   │
│  │  │ • Cookie dismiss│  │ • Capture    │  │ • Side-by-side  │  │   │
│  │  │ • Animation off│  │ • Compare    │  │ • Approve/Reject│  │   │
│  │  │ • Wait logic   │  │ • Masking    │  │ • Update baseline│ │   │
│  │  │ • Progressive  │  │              │  │                 │  │   │
│  │  │   retry        │  │              │  │                 │  │   │
│  │  └────────────────┘  └──────┬───────┘  └─────────────────┘  │   │
│  └─────────────────────────────┼────────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     OUTPUT LAYER                              │   │
│  │                                                              │   │
│  │  ┌──────���───────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │  Baselines   │  │  Reports     │  │  Trend Tracking   │  │   │
│  │  │              │  │              │  │                   │  │   │
│  │  │ chromium/    │  │ HTML Report  │  │ history.json      │  │   │
│  │  │ firefox/     │  │ Diff Panel   │  │ Pass/Fail per run │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Config  │────▶│ MCP         │────▶│  Browser     │────▶│  Screenshot  │
│  (JSON)  │     │ Orchestrator│     │  (Navigate,  │     │  Capture     │
│          │     │  (Prompts)  │     │   Stabilize) │     │  (Full Page) │
└─────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                 │
                                                                 ▼
┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Reports  │◀───│  Reporter   │◀───│  Comparison  │◀───│  Baseline    │
│ (HTML +  │     │  (Custom +  │     │  Engine      │     │  (Stored     │
│  Diffs)  │     │   Trends)   │     │  (Pixel Diff)│     │   PNG)       │
└─────────┘     └─────────────┘     └──────────────┘     └──────────────┘
```

### 4.3 Test Execution Flow (Per Page)

```
START
  │
  ▼
[1] Load page config from pages.config.json
  │
  ▼
[2] MCP Orchestrator sends navigation prompt
  │   "Navigate to {url} and wait for full page load"
  │
  ▼
[3] MCP handles cookie consent
  │   "Find cookie consent banner, click Reject All / Essential Only"
  │
  ▼
[4] Page Stabilizer executes
  │   • Wait for networkidle
  │   • Disable CSS animations/transitions
  │   • Scroll to bottom → trigger lazy content → scroll back to top
  │   • Execute page-specific mcpInstructions (e.g., "Pause carousel")
  │   • Hard settle delay
  │
  ▼
[5] Screenshot Helper captures full-page screenshot
  │   • Apply maskSelectors to hide dynamic content
  │   • Save to test-results/
  │
  ▼
[6] Comparison Engine compares against baseline
  │   • Uses page-specific maxDiffPixelRatio
  │   • Generates diff overlay image on mismatch
  │
  ▼
[7] Reporter logs result
  │   • Pass: Record in trend history
  │   • Fail: Generate diff panel + attach to HTML report
  │
  ▼
END
```

### 4.4 Retry Flow (On Failure)

```
ATTEMPT 1 (Standard)
  │ Standard stabilization
  │ Navigate → Cookie dismiss → networkidle → Disable animations → Capture
  │
  ▼ FAIL?
  │
ATTEMPT 2 (Extended)
  │ Timeout +50%
  │ Explicit wait for all <img> to load
  │ Scroll full page to trigger lazy content
  │ Re-dismiss overlays
  │ Re-capture
  │
  ▼ FAIL?
  │
ATTEMPT 3 (Maximum)
  │ Timeout ×2
  │ Force-hide all animation/transition via injected CSS
  │ 5-second hard settle delay
  │ Re-capture
  │
  ▼ FAIL? → Mark as FAILED, generate trace file
```

---

## 5. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Language** | TypeScript | 5.x | Type-safe development |
| **Test Framework** | Playwright Test | Latest | Test runner, assertions, HTML reporter |
| **Browser Automation** | Playwright | Latest | Browser control, screenshot capture |
| **AI Orchestration** | @playwright/mcp | Latest | MCP server for AI-driven browser control |
| **Package Manager** | npm | 9+ | Dependency management |

### 5.1 Key Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@playwright/mcp": "^0.0.30",
    "typescript": "^5.5.0"
  }
}
```

---

## 6. Folder Structure

```
VR_agent/
│
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md             # This document
│   └── SPRINT_PLAN.md              # Sprint roadmap and progress
│
├── config/                         # Test configuration
│   ├── pages.config.json           # URL list with per-page metadata
│   └── global.config.ts            # Type-safe config loader with interfaces
│
├── tests/                          # Test specifications
│   └── visual/
│       └── visual.spec.ts          # Data-driven visual regression test spec
│
├── utils/                          # Shared utilities
│   ├── page-stabilizer.ts          # Wait strategies, animation disabling, progressive retry
│   ├── screenshot-helper.ts        # Capture and comparison utilities
│   └── diff-reviewer.ts            # Interactive human-in-the-loop approval workflow
│
├── mcp/                            # MCP integration layer
│   ├── mcp-client.ts               # MCP session and connection management
│   ├── mcp-orchestrator.ts         # MCP-driven test orchestration logic
│   └── prompts/                    # Reusable MCP prompt templates
│       ├── navigate-and-stabilize.prompt.md
│       ├── capture-screenshot.prompt.md
│       └── compare-and-report.prompt.md
│
├── baselines/                      # Stored reference screenshots (committed to Git)
│   ├── chromium/                   # Chromium baseline images
│   │   └── {page-name}.png
│   └── firefox/                    # Firefox baseline images
│       └── {page-name}.png
│
├── reports/                        # Generated output (gitignored except trends)
│   ├── history.json                # Historical trend tracking data
│   └── (generated HTML/diff files)
│
├── playwright.config.ts            # Playwright configuration
├── package.json                    # Project dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .gitignore                      # Git ignore rules
└── README.md                       # Project documentation and quick start
```

---

## 7. Component Design

### 7.1 Config Loader (`config/global.config.ts`)

**Purpose:** Type-safe loading and merging of page configurations.

**Interfaces:**

```typescript
interface PageConfig {
  name: string;
  url: string;
  maxDiffPixelRatio: number;
  mcpInstructions: string;
  maskSelectors: string[];
  waitConditions: string[];
}

interface GlobalDefaults {
  viewport: { width: number; height: number };
  maxDiffPixelRatio: number;
  timeout: number;
  waitForNetworkIdle: boolean;
  disableAnimations: boolean;
}

interface PagesConfiguration {
  globalDefaults: GlobalDefaults;
  pages: PageConfig[];
}
```

**Functions:**
- `getPageConfigs(): PageConfig[]` — Returns all pages with global defaults merged
- `getPageConfig(pageName: string): PageConfig` — Returns a specific page's config
- `getGlobalDefaults(): GlobalDefaults` — Returns global default settings

### 7.2 MCP Client (`mcp/mcp-client.ts`)

**Purpose:** Manages MCP server lifecycle and communication.

**Responsibilities:**
- Start MCP server during `globalSetup`
- Establish connection to MCP server
- Send prompts and receive responses
- Graceful shutdown during `globalTeardown`
- Connection health monitoring

**Key Methods:**
- `initialize(): Promise<void>` — Start MCP server and connect
- `sendPrompt(prompt: string): Promise<MCPResponse>` — Send instruction to MCP
- `shutdown(): Promise<void>` — Gracefully close MCP server
- `isConnected(): boolean` — Health check

### 7.3 MCP Orchestrator (`mcp/mcp-orchestrator.ts`)

**Purpose:** Coordinates MCP-driven test execution using prompt templates.

**Responsibilities:**
- Load and hydrate prompt templates with page-specific variables
- Execute the full test workflow: navigate → stabilize → capture → compare
- Handle page-specific MCP instructions from config
- Log all MCP prompts and responses

**Key Methods:**
- `orchestratePageTest(page: PageConfig): Promise<TestResult>` — Full workflow for one page
- `loadPromptTemplate(templateName: string, variables: Record<string, string>): string` — Template hydration
- `executeNavigation(url: string): Promise<void>` — MCP-driven navigation
- `executeStabilization(page: PageConfig): Promise<void>` — MCP-driven stabilization
- `executeCookieDismissal(): Promise<void>` — MCP-driven cookie handling

### 7.4 Page Stabilizer (`utils/page-stabilizer.ts`)

**Purpose:** Ensures pages are in a consistent, deterministic state before capture.

**Stabilization Steps:**
1. Wait for `networkidle` event
2. Inject CSS to disable all animations and transitions
3. Scroll to page bottom to trigger lazy-loaded content
4. Scroll back to top
5. Execute page-specific wait conditions
6. Apply optional hard settle delay

**Progressive Stabilization Levels:**

| Level | Timeout Multiplier | Extra Steps |
|-------|-------------------|-------------|
| Standard (Attempt 1) | 1× | Basic stabilization |
| Extended (Attempt 2) | 1.5× | Wait for all `<img>` load, re-dismiss overlays |
| Maximum (Attempt 3) | 2× | Force CSS injection, 5s hard settle |

### 7.5 Screenshot Helper (`utils/screenshot-helper.ts`)

**Purpose:** Handles screenshot capture and pixel-level comparison.

**Key Methods:**
- `captureFullPage(page: Page, config: PageConfig): Promise<Buffer>` — Capture with masking
- `compareWithBaseline(actual: Buffer, baselinePath: string, config: PageConfig): ComparisonResult` — Pixel diff
- `generateDiffOverlay(actual: Buffer, baseline: Buffer): Buffer` — Visual diff image
- `saveBaseline(screenshot: Buffer, pageName: string, browser: string): void` — Store baseline

### 7.6 Diff Reviewer (`utils/diff-reviewer.ts`)

**Purpose:** Interactive human-in-the-loop baseline approval workflow.

**Workflow:**
1. Detect changed screenshots
2. Generate side-by-side comparison: Baseline | Actual | Diff Overlay
3. Present to developer with highlighted changed pixels
4. Prompt for explicit Approve/Reject per screenshot
5. On Approve: overwrite baseline and commit
6. On Reject: keep existing baseline, log rejection

### 7.7 Custom Reporter

**Purpose:** Extends Playwright's HTML reporter with visual diff panel and trend tracking.

**Components:**
- **Diff Panel:** Side-by-side view (baseline vs. actual vs. diff overlay) for each failed test
- **Trend Tracker:** JSON-based log recording pass/fail per page per browser per run
- **Trend Visualization:** Summary showing stability over last N runs per page

**Trend Data Schema:**
```json
{
  "runs": [
    {
      "timestamp": "2026-04-12T10:30:00Z",
      "results": [
        {
          "page": "homepage",
          "browser": "chromium",
          "status": "pass",
          "diffPixelRatio": 0.001,
          "duration": 15200
        }
      ]
    }
  ]
}
```

---

## 8. Configuration Design

### 8.1 Pages Configuration (`config/pages.config.json`)

```json
{
  "globalDefaults": {
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "maxDiffPixelRatio": 0.005,
    "timeout": 60000,
    "waitForNetworkIdle": true,
    "disableAnimations": true
  },
  "pages": [
    {
      "name": "homepage",
      "url": "https://kpmg.com/xx/en.html",
      "maxDiffPixelRatio": 0.008,
      "mcpInstructions": "Pause any hero carousel on the first slide",
      "maskSelectors": [],
      "waitConditions": []
    },
    {
      "name": "industries",
      "url": "https://kpmg.com/xx/en/what-we-do/industries.html",
      "maxDiffPixelRatio": 0.005,
      "mcpInstructions": "",
      "maskSelectors": [],
      "waitConditions": []
    },
    {
      "name": "services",
      "url": "https://kpmg.com/xx/en/what-we-do/services.html",
      "maxDiffPixelRatio": 0.003,
      "mcpInstructions": "",
      "maskSelectors": [],
      "waitConditions": []
    },
    {
      "name": "insights",
      "url": "https://kpmg.com/xx/en/insights.html",
      "maxDiffPixelRatio": 0.005,
      "mcpInstructions": "",
      "maskSelectors": [],
      "waitConditions": []
    },
    {
      "name": "careers",
      "url": "https://kpmg.com/xx/en/careers.html",
      "maxDiffPixelRatio": 0.005,
      "mcpInstructions": "",
      "maskSelectors": [],
      "waitConditions": []
    },
    {
      "name": "careers-job-search",
      "url": "https://kpmg.com/xx/en/careers/job-search.html",
      "maxDiffPixelRatio": 0.01,
      "mcpInstructions": "Wait for the job listing grid to fully render before capture",
      "maskSelectors": [],
      "waitConditions": []
    }
  ]
}
```

### 8.2 Playwright Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 2,
  timeout: 60000,

  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
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
```

---

## 9. MCP Integration Architecture

### 9.1 MCP Server Lifecycle

```
┌──────────────────────────────────────────────────────┐
│               TEST EXECUTION LIFECYCLE                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  globalSetup.ts                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 1. Start MCP Server (npx @playwright/mcp)     │  │
│  │ 2. Verify server health                        │  │
│  │ 3. Store connection details in global state    │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│                       ▼                              │
│  Test Execution                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ For each page in pages.config.json:            │  │
│  │   1. MCP Orchestrator loads prompt templates   │  │
│  │   2. Sends navigation + stabilization prompts  │  │
│  │   3. Captures screenshot via Playwright        │  │
│  │   4. Compares against baseline                 │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│                       ▼                              │
│  globalTeardown.ts                                   │
│  ┌────────────────────────────────────────────────┐  │
│  │ 1. Gracefully shutdown MCP Server              │  │
│  │ 2. Cleanup temporary resources                 │  │
│  │ 3. Finalize trend tracking log                 │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 9.2 MCP Prompt Templates

#### navigate-and-stabilize.prompt.md
```markdown
Navigate to {{url}} and perform the following:
1. Wait for the page to fully load (all network requests settled)
2. Look for any cookie consent banner or GDPR popup
3. If a cookie banner is found, click "Reject All" or "Essential Only" or "Decline"
4. Wait for the banner to fully disappear
5. Confirm the page is now free of overlays and modals

{{#if mcpInstructions}}
Additional page-specific instructions:
{{mcpInstructions}}
{{/if}}
```

#### capture-screenshot.prompt.md
```markdown
The page at {{url}} is now stable. Perform the following:
1. Scroll slowly to the bottom of the page to trigger any lazy-loaded content
2. Wait 2 seconds for lazy content to render
3. Scroll back to the top of the page
4. Wait 1 second for the page to settle
5. Confirm all images and media elements are fully loaded
6. The page is now ready for screenshot capture
```

### 9.3 MCP Communication Pattern

```typescript
// Example MCP orchestration flow
async function orchestratePageTest(page: PageConfig): Promise<TestResult> {
  const mcpClient = getMCPClient();

  // Step 1: Navigate and stabilize
  const navPrompt = loadPromptTemplate('navigate-and-stabilize', {
    url: page.url,
    mcpInstructions: page.mcpInstructions,
  });
  await mcpClient.sendPrompt(navPrompt);

  // Step 2: Prepare for capture
  const capturePrompt = loadPromptTemplate('capture-screenshot', {
    url: page.url,
  });
  await mcpClient.sendPrompt(capturePrompt);

  // Step 3: Take screenshot (Playwright native)
  const screenshot = await captureFullPage(browserPage, page);

  // Step 4: Compare
  const result = await compareWithBaseline(screenshot, page);

  return result;
}
```

---

## 10. Screenshot Comparison Engine

### 10.1 Comparison Strategy

| Aspect | Configuration |
|--------|--------------|
| **Method** | Pixel-level comparison via Playwright's `toHaveScreenshot()` |
| **Default Threshold** | 0.5% max diff pixel ratio (`maxDiffPixelRatio: 0.005`) |
| **Per-page Override** | Configurable in `pages.config.json` |
| **Animation Handling** | Disabled via CSS injection and Playwright's `animations: 'disabled'` |
| **Masking** | Dynamic regions masked via `maskSelectors` per page |
| **Output on Failure** | Baseline image, actual image, diff overlay image |

### 10.2 Threshold Rationale

| Page | Threshold | Rationale |
|------|-----------|-----------|
| Homepage | 0.8% | Hero carousel, dynamic banners |
| Industries | 0.5% | Standard content page |
| Services | 0.3% | Mostly static content, can be strict |
| Insights | 0.5% | Article listings may update |
| Careers | 0.5% | Standard content page |
| Job Search | 1.0% | Dynamic job listings, highest variability |

---

## 11. Baseline Management

### 11.1 Storage Structure

```
baselines/
├── chromium/
│   ├── homepage.png
│   ├── industries.png
│   ├── services.png
│   ├── insights.png
│   ├── careers.png
│   └── careers-job-search.png
└── firefox/
    ├── homepage.png
    ├── industries.png
    ├── services.png
    ├── insights.png
    ├── careers.png
    └── careers-job-search.png
```

### 11.2 Baseline Update Workflow

```
Developer runs: npm run update-baselines
        │
        ▼
[1] Framework captures fresh screenshots for all pages
        │
        ▼
[2] Diff Reviewer compares each new screenshot against stored baseline
        │
        ▼
[3] For each changed screenshot:
    ┌─────────────────────────────────────────────┐
    │ ┌───────────┐  ┌───────────┐  ┌──────────┐ │
    │ │  BASELINE  │  │  ACTUAL   │  │   DIFF   │ │
    │ │  (stored)  │  │  (new)    │  │ (overlay)│ │
    │ └───────────┘  └───────────┘  └──────────┘ │
    │                                             │
    │ Changed pixels highlighted in red           │
    │                                             │
    │ [A] Approve  |  [R] Reject  |  [S] Skip    │
    └─────────────────────────────────────────────┘
        │
        ▼
[4] Approved → Baseline overwritten, staged for Git commit
    Rejected → Baseline preserved, change logged for investigation
```

---

## 12. Error Handling & Retry Strategy

### 12.1 Progressive Stabilization Matrix

| Attempt | Timeout | Wait Strategy | Extra Steps | Trace |
|---------|---------|--------------|-------------|-------|
| **1** (Standard) | 60s | `networkidle` | Dismiss cookies, disable animations | No |
| **2** (Extended) | 90s (+50%) | `networkidle` + `img` load check | Re-dismiss overlays, full-page scroll, 2s settle | Yes (trace captured) |
| **3** (Maximum) | 120s (×2) | `networkidle` + `img` + `font` load | Force CSS injection, 5s hard settle, re-scroll | Yes |

### 12.2 Error Categories

| Error Type | Handling |
|-----------|----------|
| **Navigation timeout** | Retry with extended timeout |
| **Cookie banner not found** | Log warning, continue (banner may not appear) |
| **MCP connection failure** | Abort test run, log error, suggest restart |
| **Screenshot mismatch** | Generate diff, apply retry strategy |
| **MCP prompt timeout** | Retry prompt with simplified instructions |

---

## 13. Reporting Architecture

### 13.1 Report Components

```
┌──────────────────────────────────────────────────────┐
│                  REPORTING PIPELINE                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │        Playwright HTML Report (Built-in)      │    │
│  │  • Pass/fail status per test                  │    │
│  │  • Test duration and retry info               │    │
│  │  • Screenshot attachments for failures        │    │
│  │  • Trace file links for failed retries        │    │
│  └──────────────────────────────────────────────┘    │
│                       +                              │
│  ┌──────────────────────────────────────────────┐    │
│  │        Custom Visual Diff Panel               │    │
│  │  • Side-by-side: Baseline | Actual | Diff     │    │
│  │  • Changed pixels highlighted in red          │    │
│  │  • Diff percentage displayed                  │    │
│  │  • Slider overlay for quick comparison        │    │
│  └──────────────────────────────────────────────┘    │
│                       +                              │
│  ┌──────────────────────────────────────────────┐    │
│  │        Historical Trend Tracking              │    │
│  │  • JSON log: reports/history.json             │    │
│  │  • Per-page, per-browser pass/fail over time  │    │
│  │  • Identifies chronically unstable pages      │    │
│  │  • Summary: "Homepage: 8/10 passed (last 10)" │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 13.2 Report Output Location

| Report | Location | Git Tracked |
|--------|----------|-------------|
| Playwright HTML | `playwright-report/` | No (gitignored) |
| Custom Diff Panel | `reports/diff-report.html` | No (gitignored) |
| Trend History | `reports/history.json` | Yes (committed) |
| Test Results JSON | `reports/results.json` | No (gitignored) |

---

## 14. Logging & Debugging

### 14.1 Log Levels

| Level | Content | When |
|-------|---------|------|
| **INFO** | Test start/end, page navigation, screenshot capture | Always |
| **DEBUG** | MCP prompts sent, MCP responses received, stabilization steps | When `DEBUG=true` |
| **WARN** | Cookie banner not found, non-critical timeouts | Always |
| **ERROR** | Test failures, MCP connection errors, comparison failures | Always |

### 14.2 MCP-Specific Logging

Every MCP interaction is logged with:
- **Timestamp** — when the prompt was sent
- **Prompt** — the full instruction sent to MCP
- **Response** — MCP's response/acknowledgment
- **Duration** — how long the MCP action took
- **Status** — success/failure

### 14.3 Playwright Trace Files

- **When captured:** On first retry only (`trace: 'on-first-retry'`)
- **Contents:** DOM snapshots, network requests, console logs, screenshots at each action
- **Location:** `test-results/` directory
- **How to view:** `npx playwright show-trace <trace-file.zip>`

---

## 15. Test Execution Strategy

### 15.1 Execution Model

```
┌─────────────────────────────────────────────┐
│          npx playwright test                 │
│                                             │
│  Worker 1 (Chromium)    Worker 2 (Firefox)  │
│  ┌───────────────┐     ┌───────────────┐    │
│  │ 1. homepage   │     │ 1. homepage   │    │
│  │ 2. industries │     │ 2. industries │    │
│  │ 3. services   │     │ 3. services   │    │
│  │ 4. insights   │     │ 4. insights   │    │
│  │ 5. careers    │     │ 5. careers    │    │
│  │ 6. job-search │     │ 6. job-search │    │
│  └───────────────┘     └───────────────┘    │
│                                             │
│  ◀── Sequential ──▶   ◀── Sequential ──▶   │
│  ◀──────── Parallel between browsers ──────▶│
│                                             │
│  Estimated: ~2-3 minutes total              │
└─────────────────────────────────────────────┘
```

### 15.2 NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `npx playwright test` | Run all visual tests |
| `npm run test:chromium` | `npx playwright test --project=chromium` | Chromium only |
| `npm run test:firefox` | `npx playwright test --project=firefox` | Firefox only |
| `npm run update-baselines` | `npx playwright test --update-snapshots` | Regenerate baselines |
| `npm run report` | `npx playwright show-report` | Open HTML report |

---

## 16. Sprint Roadmap

### Sprint 1: Foundation (Current)
**Goal:** Project scaffolding and architecture documentation

| Deliverable | Status |
|-------------|--------|
| `docs/ARCHITECTURE.md` | ✅ |
| `docs/SPRINT_PLAN.md` | ✅ |
| `package.json` + `tsconfig.json` | ✅ |
| `playwright.config.ts` | ✅ |
| `config/pages.config.json` | ✅ |
| `config/global.config.ts` | ✅ |
| Folder structure scaffolding | ✅ |
| `README.md` + `.gitignore` | ✅ |

### Sprint 2: MCP Integration
**Goal:** MCP server lifecycle, orchestrator, page stabilizer, cookie handling

| Deliverable | Status |
|-------------|--------|
| `mcp/mcp-client.ts` | 🔲 |
| `mcp/mcp-orchestrator.ts` | 🔲 |
| `mcp/global-setup.ts` | 🔲 |
| `mcp/global-teardown.ts` | 🔲 |
| `mcp/prompts/*.prompt.md` | 🔲 |
| `utils/page-stabilizer.ts` | 🔲 |

### Sprint 3: Screenshot Engine
**Goal:** Capture, comparison, baseline management, data-driven test spec

| Deliverable | Status |
|-------------|--------|
| `utils/screenshot-helper.ts` | 🔲 |
| `tests/visual/visual.spec.ts` | 🔲 |
| Baseline generation workflow | 🔲 |
| Comparison engine integration | 🔲 |

### Sprint 4: Reporting
**Goal:** Interactive diff reviewer, custom reporter, trend tracking

| Deliverable | Status |
|-------------|--------|
| `utils/diff-reviewer.ts` | 🔲 |
| Custom Playwright reporter | 🔲 |
| `reports/history.json` schema | 🔲 |
| Diff panel HTML generation | 🔲 |

### Sprint 5: Resilience & Validation
**Goal:** Smart retry, logging, trace integration, end-to-end validation

| Deliverable | Status |
|-------------|--------|
| Progressive retry in `page-stabilizer.ts` | 🔲 |
| Logging framework | 🔲 |
| Trace integration | 🔲 |
| End-to-end validation (zero-diff test) | 🔲 |
| Final documentation | 🔲 |

---

## 17. Phase 0 Success Criteria

### Primary Success Metric

> **Running the test suite twice consecutively with no code changes produces ZERO diffs across all 12 screenshots (6 pages × 2 browsers).**

### Validation Steps

1. Run `npm test` — all 12 tests pass, baselines are generated
2. Run `npm test` again immediately — all 12 tests pass with zero diffs
3. Verify all baselines are stored in `baselines/chromium/` and `baselines/firefox/`
4. Verify HTML report generates correctly with all test results
5. Verify trend history log captures both runs

### Acceptance Checklist

- [ ] All 6 KPMG pages load successfully in both Chromium and Firefox
- [ ] Cookie consent banners are dismissed on all pages
- [ ] Full-page screenshots capture complete page content
- [ ] Baselines are deterministic (zero diffs on repeat runs)
- [ ] HTML report displays pass/fail status with screenshots
- [ ] Diff panel generates side-by-side comparison for failures
- [ ] Trend history tracks run results
- [ ] Smart retry handles intermittent page load issues
- [ ] MCP orchestration logs all prompts and responses
- [ ] Human-in-the-loop baseline approval workflow functions correctly

---

## 18. Future Phases

| Phase | Scope | Key Additions |
|-------|-------|---------------|
| **Phase 1** | CI/CD Integration | GitHub Actions pipeline, scheduled runs, PR-triggered tests |
| **Phase 2** | Extended Coverage | Mobile viewports, WebKit browser, additional KPMG pages |
| **Phase 3** | Advanced AI | AI-driven visual assessment, intelligent anomaly detection |
| **Phase 4** | Scale | Git LFS for baselines, parallel cloud execution, dashboard |

---

## 19. Appendix

### A. Glossary

| Term | Definition |
|------|-----------|
| **Baseline** | A stored reference screenshot representing the expected visual state |
| **Diff** | The pixel-level difference between a baseline and a newly captured screenshot |
| **MCP** | Model Context Protocol — enables AI agents to interact with browsers |
| **maxDiffPixelRatio** | The maximum allowed ratio of different pixels (0.005 = 0.5%) |
| **Visual Regression** | An unintended change in the visual appearance of a web page |
| **Progressive Stabilization** | Escalating wait/retry strategy to achieve consistent page state |

### B. Reference Links

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright MCP (GitHub)](https://github.com/microsoft/playwright-mcp)
- [@playwright/mcp (npm)](https://www.npmjs.com/package/@playwright/mcp)
- [Playwright MCP Getting Started](https://playwright.dev/docs/getting-started-mcp)

### C. Screenshot Matrix

| # | Page | Chromium | Firefox |
|---|------|----------|---------|
| 1 | Homepage | `baselines/chromium/homepage.png` | `baselines/firefox/homepage.png` |
| 2 | Industries | `baselines/chromium/industries.png` | `baselines/firefox/industries.png` |
| 3 | Services | `baselines/chromium/services.png` | `baselines/firefox/services.png` |
| 4 | Insights | `baselines/chromium/insights.png` | `baselines/firefox/insights.png` |
| 5 | Careers | `baselines/chromium/careers.png` | `baselines/firefox/careers.png` |
| 6 | Job Search | `baselines/chromium/careers-job-search.png` | `baselines/firefox/careers-job-search.png` |

---

*Document Version: 1.0.0*  
*Last Updated: 2026-04-12*  
*Author: @sashokkumar2389*