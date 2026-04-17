import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getMCPClient, MCPResponse } from './mcp-client';
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
  prompt: string;
  response: string;
  durationMs: number;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Template hydration
// ---------------------------------------------------------------------------

const PROMPTS_DIR = resolve(__dirname, 'prompts');

/**
 * Loads a .prompt.md template and replaces {{variable}} placeholders.
 */
export function loadPromptTemplate(
  templateName: string,
  variables: Record<string, string>
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
  private logs: MCPLog[] = [];

  /**
   * Runs the full MCP-driven test workflow for a single page.
   * Returns the result so the Playwright test spec can make assertions.
   */
  async orchestratePageTest(pageConfig: PageConfig, browser: string): Promise<TestResult> {
    this.logs = [];
    const start = Date.now();

    try {
      await this.executeNavigation(pageConfig);
      await this.executeCookieDismissal(pageConfig);
      await this.executeStabilization(pageConfig);
      await this.executeCapturePrep(pageConfig);

      return {
        page: pageConfig.name,
        browser,
        status: 'pass',
        durationMs: Date.now() - start,
        mcpLogs: [...this.logs],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('MCPOrchestrator', `Error on page "${pageConfig.name}"`, { message });

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
   * Sends the navigation + cookie dismissal prompt for a page.
   */
  async executeNavigation(pageConfig: PageConfig): Promise<void> {
    const prompt = loadPromptTemplate('navigate-and-stabilize', {
      url: pageConfig.url,
      mcpInstructions: pageConfig.mcpInstructions
        ? `Additional instructions:\n${pageConfig.mcpInstructions}`
        : '',
    });

    const response = await this.sendAndLog('navigate-and-stabilize', prompt);

    if (!response.success) {
      throw new Error(`Navigation failed for ${pageConfig.url}: ${response.content}`);
    }
  }

  /**
   * Cookie dismissal is handled within the navigate-and-stabilize prompt.
   * This method exists as an explicit hook for pages that need a second pass.
   */
  async executeCookieDismissal(pageConfig: PageConfig): Promise<void> {
    logger.debug('MCPOrchestrator', `Cookie dismissal handled via navigation prompt`, { page: pageConfig.name });
  }

  /**
   * Sends the capture-preparation prompt so MCP scrolls and verifies load state.
   */
  async executeStabilization(pageConfig: PageConfig): Promise<void> {
    const prompt = loadPromptTemplate('capture-screenshot', {
      url: pageConfig.url,
    });

    const response = await this.sendAndLog('capture-screenshot', prompt);

    if (!response.success) {
      // Non-fatal — log and continue; Playwright stabilizer will compensate
      logger.warn('MCPOrchestrator', `Stabilization warning for ${pageConfig.name}`, { response: response.content });
    }
  }

  /**
   * Alias kept for symmetry with ARCHITECTURE spec.
   */
  async executeCapturePrep(pageConfig: PageConfig): Promise<void> {
    logger.debug('MCPOrchestrator', `Page "${pageConfig.name}" ready for capture`);
  }

  /**
   * Returns the accumulated MCP interaction logs for this orchestration run.
   */
  getLogs(): MCPLog[] {
    return [...this.logs];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async sendAndLog(label: string, prompt: string): Promise<MCPResponse> {
    const client = getMCPClient();
    const timestamp = new Date().toISOString();

    logger.debug('MCPOrchestrator', `Sending prompt: ${label}`, { promptPreview: prompt.slice(0, 120) });

    const response = await client.sendPrompt(prompt);

    const log: MCPLog = {
      timestamp,
      prompt,
      response: response.content,
      durationMs: response.durationMs,
      success: response.success,
    };
    this.logs.push(log);

    logger.debug('MCPOrchestrator', `Response received: ${label}`, {
      durationMs: response.durationMs,
      success: response.success,
      responsePreview: response.content.slice(0, 120),
    });

    return response;
  }
}
