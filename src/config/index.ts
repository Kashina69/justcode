import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Load environment variables from .env file in the current working directory.
dotenv.config();

export const MAX_MEMORY_RECALL_TOKENS = 4000;

export interface ModelConfig {
  provider: string; // references a provider name from providers, or 'anthropic' / 'openai-compat'
  modelId: string;
}

export interface ProviderConfig {
  type: 'anthropic' | 'openai-compat';
  apiKey: string;
  endpoint?: string;
}

export interface AppConfig {
  anthropicApiKey: string | undefined;
  anthropicEndpoint?: string;
  openaiApiKey: string | undefined;
  openaiEndpoint: string | undefined;
  modelAliases: {
    fast: ModelConfig;
    smart: ModelConfig;
    planner: ModelConfig;
  };
  providers?: Record<string, ProviderConfig>;
}

/**
 * Loads the application configuration from environment variables and config files.
 * Defaults are provided if configurations are missing.
 * 
 * @returns The resolved AppConfig object.
 */
export function loadAppConfig(): AppConfig {
  // Base defaults
  const defaults: AppConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicEndpoint: process.env.ANTHROPIC_API_ENDPOINT,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiEndpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1',
    modelAliases: {
      fast: {
        provider: 'anthropic',
        modelId: process.env.MODEL_FAST || 'claude-3-5-haiku-20241022',
      },
      smart: {
        provider: 'anthropic',
        modelId: process.env.MODEL_SMART || 'claude-3-5-sonnet-20241022',
      },
      planner: {
        provider: 'anthropic',
        modelId: process.env.MODEL_PLANNER || 'claude-3-5-sonnet-20241022',
      },
    },
    providers: {},
  };

  // Try to load global config from ~/.agent/config.json or local config.json in project root
  let configPath = path.join(os.homedir(), '.agent', 'config.json');
  if (!process.env.VITEST && !fs.existsSync(configPath)) {
    configPath = path.join(process.cwd(), 'config.json');
  }
  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);

      return {
        anthropicApiKey: parsedConfig.anthropicApiKey || defaults.anthropicApiKey,
        anthropicEndpoint: parsedConfig.anthropicEndpoint || defaults.anthropicEndpoint,
        openaiApiKey: parsedConfig.openaiApiKey || defaults.openaiApiKey,
        openaiEndpoint: parsedConfig.openaiEndpoint || defaults.openaiEndpoint,
        modelAliases: {
          fast: parsedConfig.modelAliases?.fast || defaults.modelAliases.fast,
          smart: parsedConfig.modelAliases?.smart || defaults.modelAliases.smart,
          planner: parsedConfig.modelAliases?.planner || defaults.modelAliases.planner,
        },
        providers: parsedConfig.providers || {},
      };
    }
  } catch (error) {
    // Ignore issues reading configuration and return defaults
  }

  return defaults;
}

/**
 * Returns the path to the global user config file in home directory.
 */
export function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.agent', 'config.json');
}

/**
 * Syncs the provided configuration parameters to the global config file.
 */
export function writeAppConfig(config: Partial<AppConfig>): void {
  const configPath = getGlobalConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing: any = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // Ignore corrupt json files
    }
  }

  const merged = {
    ...existing,
    ...config,
    modelAliases: {
      ...(existing.modelAliases || {}),
      ...(config.modelAliases || {}),
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
}
