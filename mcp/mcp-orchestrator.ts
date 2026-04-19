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
      // Cookie banners are suppressed via pre-injected consent cookies
      // (config/cookies.json → context.addCookies in visual.spec.ts).
      // No runtime dismissal needed.
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
