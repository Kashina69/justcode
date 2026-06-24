import { describe, it, expect } from 'vitest';
import { getProviderForAlias } from '../../src/providers/factory.js';
import { AnthropicMessagesProvider } from '../../src/providers/anthropic.js';
import { OpenAiCompatibleProvider } from '../../src/providers/openai.js';
describe('ProviderFactory', () => {
    const dummyConfig = {
        anthropicApiKey: 'anthropic-key',
        openaiApiKey: 'openai-key',
        openaiEndpoint: 'https://api.openai.com/v1',
        modelAliases: {
            fast: { provider: 'openai-compat', modelId: 'gpt-4o-mini' },
            smart: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
            planner: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
        },
    };
    it('should instantiate OpenAiCompatibleProvider for fast alias', () => {
        const provider = getProviderForAlias('fast', dummyConfig);
        expect(provider).toBeInstanceOf(OpenAiCompatibleProvider);
    });
    it('should instantiate AnthropicMessagesProvider for smart alias', () => {
        const provider = getProviderForAlias('smart', dummyConfig);
        expect(provider).toBeInstanceOf(AnthropicMessagesProvider);
    });
    it('should instantiate provider from custom config.providers map for anthropic type', () => {
        const customConfig = {
            ...dummyConfig,
            modelAliases: {
                ...dummyConfig.modelAliases,
                fast: { provider: 'custom-anthropic', modelId: 'custom-model' }
            },
            providers: {
                'custom-anthropic': {
                    type: 'anthropic',
                    apiKey: 'custom-anthropic-key',
                    endpoint: 'https://custom-anthropic.com'
                }
            }
        };
        const provider = getProviderForAlias('fast', customConfig);
        expect(provider).toBeInstanceOf(AnthropicMessagesProvider);
    });
    it('should instantiate provider from custom config.providers map for openai-compat type', () => {
        const customConfig = {
            ...dummyConfig,
            modelAliases: {
                ...dummyConfig.modelAliases,
                fast: { provider: 'custom-openai', modelId: 'custom-model' }
            },
            providers: {
                'custom-openai': {
                    type: 'openai-compat',
                    apiKey: 'custom-openai-key',
                    endpoint: 'https://custom-openai.com'
                }
            }
        };
        const provider = getProviderForAlias('fast', customConfig);
        expect(provider).toBeInstanceOf(OpenAiCompatibleProvider);
    });
});
