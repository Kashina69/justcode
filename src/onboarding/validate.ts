import { AppConfig } from '../config/index.js';

export interface ValidationResult {
  valid: boolean;
  error: string;
}

export function validateProviderConfig(config: AppConfig): ValidationResult {
  const activeSmartConfig = config.modelAliases.smart;
  const providerName = activeSmartConfig.provider;

  if (config.providers && config.providers[providerName]) {
    if (!config.providers[providerName].apiKey) {
      return { valid: false, error: `Error: API key for provider "${providerName}" is not set in configuration.` };
    }
  } else {
    if (providerName === 'anthropic' && !config.anthropicApiKey) {
      return {
        valid: false,
        error: 'Error: ANTHROPIC_API_KEY is not set but is required by the active "smart" model provider.\n' +
          'Please set it using: $env:ANTHROPIC_API_KEY="your-key" in PowerShell or set ANTHROPIC_API_KEY="your-key" in Command Prompt',
      };
    }
    if (providerName === 'openai-compat') {
      const isLocal = config.openaiEndpoint?.includes('localhost') || config.openaiEndpoint?.includes('127.0.0.1');
      if (!config.openaiApiKey && !isLocal) {
        return {
          valid: false,
          error: 'Error: OPENAI_API_KEY is not set but is required by the active "smart" OpenAI provider.\n' +
            'Please set it using: $env:OPENAI_API_KEY="your-key" in PowerShell or set OPENAI_API_KEY="your-key" in Command Prompt',
        };
      }
    } else if (!config.anthropicApiKey) {
      return {
        valid: false,
        error: `Error: ANTHROPIC_API_KEY is not set but is required as a fallback for provider "${providerName}".`,
      };
    }
  }

  return { valid: true, error: '' };
}

export function needsOnboarding(config: AppConfig): boolean {
  const hasLocalOpenAi = config.openaiEndpoint?.includes('localhost') || config.openaiEndpoint?.includes('127.0.0.1');
  return !config.anthropicApiKey && !config.openaiApiKey && !hasLocalOpenAi;
}
