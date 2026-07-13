import { ModelProvider, ModelAlias } from './types.js';
import { AnthropicMessagesProvider } from './anthropic.js';
import { OpenAiCompatibleProvider } from './openai.js';
import { AppConfig } from '../config/index.js';

/**
 * Returns the appropriate ModelProvider instance dynamically mapped to the specified alias.
 * 
 * @param alias The model alias ("fast" | "smart" | "planner").
 * @param config The application configuration context.
 * @returns The resolved ModelProvider.
 */
export function getProviderForAlias(alias: ModelAlias, config: AppConfig): ModelProvider {
  const modelConfig = config.modelAliases[alias];
  const providerName = modelConfig ? modelConfig.provider : 'anthropic';

  // Check if providerName refers to a custom provider defined in config.providers
  if (config.providers && config.providers[providerName]) {
    const customProvider = config.providers[providerName];
    const clonedConfig = { ...config };
    if (customProvider.type === 'anthropic') {
      clonedConfig.anthropicApiKey = customProvider.apiKey;
      clonedConfig.anthropicEndpoint = customProvider.endpoint;
      return new AnthropicMessagesProvider(clonedConfig);
    } else {
      clonedConfig.openaiApiKey = customProvider.apiKey;
      clonedConfig.openaiEndpoint = customProvider.endpoint;
      return new OpenAiCompatibleProvider(clonedConfig);
    }
  }

  if (providerName === 'openai-compat') {
    return new OpenAiCompatibleProvider(config);
  }
  return new AnthropicMessagesProvider(config);
}
