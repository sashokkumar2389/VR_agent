import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MCPConnection, MCPResponse, callTool } from './mcp-client';
import { PageConfig } from '../config/global.config';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestResult {
  page: string;
  browser: string;
  status: 'pass' | 'fail' | 'error';
  durationMs: number;
  mcpLogs: MCPLog[];
}

export interface MCPLog {
  timestamp: string;
  tool: string;
  args: Record<string, unknown>;
  response: string;
  durationMs: number;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Cookie dismiss patterns (ADR-017: reject all / essential only)
// ---------------------------------------------------------------------------

const COOKIE_BUTTON_PATTERNS = [
  /reject\s*all/i,
  /essential\s*only/i,
  /decline\b/i,
  /necessary\s*only/i,
  /only\s*necessary/i,
];

// ---------------------------------------------------------------------------
// Template hydration (kept for documentation / logging)
// ---------------------------------------------------------------------------

const PROMPTS_DIR = resolve(__dirname, 'prompts');

/**
 * Loads a .prompt.md template and replaces {{variable}} placeholders.
 */
export function loadPromptTemplate(
  templateName: string,
  variables: Record<string, string>,
): string {
  const templatePath = resolve(PROMPTS_DIR, `${templateName}.prompt.md`);
  let template = readFileSync(templatePath, 'utf-8');

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }

  return template;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class MCPOrchestrator {
  private connection: MCPConnection;
  private logs: MCPLog[] = [];

  constructor(connection: MCPConnection) {
    this.connection = connection;
  }

  /**
   * Runs the MCP-driven workflow for a single page:
   *   1. Navigate to the URL (MCP creates a tab in the shared BrowserContext)
   *   2. Snapshot the page accessibility tree
   *   3. Dismiss cookie/GDPR banners if found
   *   4. Log page-specific MCP instructions
   *
   * After this method returns the test's own `page` object can navigate
   * to the same URL — cookies set here carry over via the shared context.
   */
  async orchestratePageTest(
    pageConfig: PageConfig,
    browser: string,
  ): Promise<TestResult> {
    this.logs = [];
    const start = Date.now();

    try {
      await this.executeNavigation(pageConfig);
      await this.executeCookieDismissal();
      await this.executePageInstructions(pageConfig);

      return {
        page: pageConfig.name,
        browser,
        status: 'pass',
        durationMs: Date.now() - start,
        mcpLogs: [...this.logs],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('MCPOrchestrator', `Error on "${pageConfig.name}"`, {
        message,
      });

      return {
        page: pageConfig.name,
        browser,
        status: 'error',
        durationMs: Date.now() - start,
        mcpLogs: [...this.logs],
      };
    }
  }

  /**
   * Returns the accumulated MCP interaction logs for this orchestration run.
   */
  getLogs(): MCPLog[] {
    return [...this.logs];
  }

  /**
   * Hydrates the compare-and-report prompt template (Architecture §9.2) and
   * logs the comparison outcome.  Called from visual.spec.ts after the
   * screenshot assertion completes.
   */
  logComparisonResult(pageConfig: PageConfig, browser: string, passed: boolean): void {
    const prompt = loadPromptTemplate('compare-and-report', {
      pageName: pageConfig.name,
      browser,
      threshold: String(pageConfig.maxDiffPixelRatio * 100),
    });

    logger.info('MCPOrchestrator', `Comparison: ${passed ? 'PASS' : 'FAIL'}`, {
      page: pageConfig.name,
      browser,
      thresholdPct: pageConfig.maxDiffPixelRatio * 100,
      templatePreview: prompt.slice(0, 200),
    });
  }

  // -----------------------------------------------------------------------
  // Workflow steps
  // -----------------------------------------------------------------------

  private async executeNavigation(pageConfig: PageConfig): Promise<void> {
    const response = await this.callAndLog('browser_navigate', {
      url: pageConfig.url,
    });

    if (!response.success) {
      throw new Error(
        `Navigation failed for ${pageConfig.url}: ${response.content}`,
      );
    }

    logger.info('MCPOrchestrator', `Navigated to ${pageConfig.url}`);
  }

  private async executeCookieDismissal(): Promise<void> {
    // Snapshot the page accessibility tree to find cookie buttons
    const snapshot = await this.callAndLog('browser_snapshot', {});

    if (!snapshot.success) {
      logger.warn(
        'MCPOrchestrator',
        'Snapshot failed during cookie check',
      );
      return;
    }

    const button = this.findCookieButton(snapshot.content);

    if (!button) {
      logger.debug('MCPOrchestrator', 'No cookie banner found');
      return;
    }

    const click = await this.callAndLog('browser_click', {
      element: button.element,
      ref: button.ref,
    });

    if (click.success) {
      logger.info(
        'MCPOrchestrator',
        `Cookie banner dismissed: "${button.element}"`,
      );
    } else {
      logger.warn(
        'MCPOrchestrator',
        `Cookie click failed: ${click.content}`,
      );
    }
  }

  private async executePageInstructions(
    pageConfig: PageConfig,
  ): Promise<void> {
    if (!pageConfig.mcpInstructions) {
      return;
    }

    // Log the instruction for debugging; page-specific MCP tool
    // sequences will be refined as the project matures.
    logger.debug('MCPOrchestrator', 'Page instructions noted', {
      page: pageConfig.name,
      instructions: pageConfig.mcpInstructions,
    });
  }

  // -----------------------------------------------------------------------
  // Snapshot parsing
  // -----------------------------------------------------------------------

  private findCookieButton(
    snapshot: string,
  ): { element: string; ref: string } | null {
    const lines = snapshot.split('\n');

    for (const line of lines) {
      // Snapshot format: - ref=<id> button "Button Text"
      const match = line.match(/ref=([\w.]+)\s+button\s+"([^"]+)"/i);
      if (!match) continue;

      const ref = match[1]!;
      const text = match[2]!;

      if (COOKIE_BUTTON_PATTERNS.some((p) => p.test(text))) {
        return { element: text, ref };
      }
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Tool call helper with structured logging
  // -----------------------------------------------------------------------

  private async callAndLog(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPResponse> {
    const timestamp = new Date().toISOString();

    logger.debug('MCPOrchestrator', `Calling tool: ${toolName}`, { args });

    const response = await callTool(this.connection, toolName, args);

    this.logs.push({
      timestamp,
      tool: toolName,
      args,
      response: response.content.slice(0, 500),
      durationMs: response.durationMs,
      success: response.success,
    });

    logger.debug('MCPOrchestrator', `Tool response: ${toolName}`, {
      durationMs: response.durationMs,
      success: response.success,
      preview: response.content.slice(0, 120),
    });

    return response;
  }
}
