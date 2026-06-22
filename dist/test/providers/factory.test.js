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
});
