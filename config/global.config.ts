import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PageConfig {
    name: string;
    url: string;
    maxDiffPixelRatio: number;
    mcpInstructions: string;
    maskSelectors: string[];
    waitConditions: string[];
}

export interface GlobalDefaults {
    viewport: { width: number; height: number };
    maxDiffPixelRatio: number;
    timeout: number;
    waitForNetworkIdle: boolean;
    disableAnimations: boolean;
}

export interface PagesConfiguration {
    globalDefaults: GlobalDefaults;
    pages: RawPageConfig[];
}

interface RawPageConfig {
    name: string;
    url: string;
    maxDiffPixelRatio?: number;
    mcpInstructions?: string;
    maskSelectors?: string[];
    waitConditions?: string[];
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

const CONFIG_PATH = resolve(__dirname, 'pages.config.json');

function loadRawConfig(): PagesConfiguration {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as PagesConfiguration;
}

/**
 * Returns global default settings from pages.config.json.
 */
export function getGlobalDefaults(): GlobalDefaults {
    return loadRawConfig().globalDefaults;
}

/**
 * Returns all page configs with global defaults merged in for missing fields.
 */
export function getPageConfigs(): PageConfig[] {
    const { globalDefaults, pages } = loadRawConfig();

    return pages.map((raw) => ({
        name: raw.name,
        url: raw.url,
        maxDiffPixelRatio: raw.maxDiffPixelRatio ?? globalDefaults.maxDiffPixelRatio,
        mcpInstructions: raw.mcpInstructions ?? '',
        maskSelectors: raw.maskSelectors ?? [],
        waitConditions: raw.waitConditions ?? [],
    }));
}

/**
 * Returns the config for a single page by name. Throws if not found.
 */
export function getPageConfig(pageName: string): PageConfig {
    const all = getPageConfigs();
    const found = all.find((p) => p.name === pageName);
    if (!found) {
        throw new Error(`Page config not found for: "${pageName}"`);
    }
    return found;
}
