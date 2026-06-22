import { AnthropicMessagesProvider } from './anthropic.js';
import { OpenAiCompatibleProvider } from './openai.js';
/**
 * Returns the appropriate ModelProvider instance dynamically mapped to the specified alias.
 *
 * @param alias The model alias ("fast" | "smart" | "planner").
 * @param config The application configuration context.
 * @returns The resolved ModelProvider.
 */
export function getProviderForAlias(alias, config) {
    const modelConfig = config.modelAliases[alias];
    const providerType = modelConfig ? modelConfig.provider : 'anthropic';
    if (providerType === 'openai-compat') {
        return new OpenAiCompatibleProvider(config);
    }
    return new AnthropicMessagesProvider(config);
}
