import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAiCompatibleProvider } from '../../src/providers/openai.js';
describe('OpenAiCompatibleProvider', () => {
    const dummyConfig = {
        anthropicApiKey: undefined,
        openaiApiKey: 'dummy-openai-key',
        openaiEndpoint: 'https://api.dummy.com/v1',
        modelAliases: {
            fast: { provider: 'openai-compat', modelId: 'gpt-4o-mini' },
            smart: { provider: 'openai-compat', modelId: 'gpt-4o' },
            planner: { provider: 'openai-compat', modelId: 'gpt-4-turbo' },
        },
    };
    const mockFetch = vi.fn();
    beforeEach(() => {
        global.fetch = mockFetch;
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('should format message history and execute completion successfully', async () => {
        const mockResponseData = {
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: 'Hello world response',
                        tool_calls: [
                            {
                                id: 'call-1',
                                type: 'function',
                                function: {
                                    name: 'read_file',
                                    arguments: '{"path":"plan.md"}',
                                },
                            },
                        ],
                    },
                },
            ],
            usage: {
                prompt_tokens: 30,
                completion_tokens: 45,
            },
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponseData,
        });
        const provider = new OpenAiCompatibleProvider(dummyConfig);
        const result = await provider.complete({
            systemPrompt: 'System rule',
            messages: [{ role: 'user', content: 'hello' }],
            availableTools: [],
            modelAlias: 'smart',
        });
        expect(mockFetch).toHaveBeenCalled();
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe('https://api.dummy.com/v1/chat/completions');
        expect(options.method).toBe('POST');
        expect(options.headers['Authorization']).toBe('Bearer dummy-openai-key');
        const body = JSON.parse(options.body);
        expect(body.model).toBe('gpt-4o');
        expect(body.messages[0]).toEqual({ role: 'system', content: 'System rule' });
        expect(body.messages[1]).toEqual({ role: 'user', content: 'hello' });
        expect(result.textContent).toBe('Hello world response');
        expect(result.requestedToolCalls).toHaveLength(1);
        expect(result.requestedToolCalls[0]).toEqual({
            id: 'call-1',
            name: 'read_file',
            input: { path: 'plan.md' },
        });
        expect(result.tokenUsage).toEqual({ inputTokens: 30, outputTokens: 45 });
    });
    it('should parse reasoning_content and cache hits for DeepSeek-like models', async () => {
        const mockResponseData = {
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: 'Actual final text',
                        reasoning_content: 'DeepSeek reasoning block content',
                    },
                },
            ],
            usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                prompt_tokens_details: {
                    cached_tokens: 40,
                },
            },
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponseData,
        });
        const provider = new OpenAiCompatibleProvider(dummyConfig);
        const result = await provider.complete({
            systemPrompt: 'System',
            messages: [{ role: 'user', content: 'hello' }],
            availableTools: [],
            modelAlias: 'smart',
        });
        expect(result.textContent).toBe('Actual final text');
        expect(result.thinkingContent).toBe('DeepSeek reasoning block content');
        expect(result.cacheHit).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
    it('should strip inline <think> tags from textContent and return it as thinkingContent', async () => {
        const mockResponseData = {
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: '<think>\nInline reasoning content here\n</think>\nActual text output here',
                    },
                },
            ],
            usage: {
                prompt_tokens: 50,
                completion_tokens: 60,
            },
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponseData,
        });
        const provider = new OpenAiCompatibleProvider(dummyConfig);
        const result = await provider.complete({
            systemPrompt: 'System',
            messages: [{ role: 'user', content: 'hello' }],
            availableTools: [],
            modelAlias: 'smart',
        });
        expect(result.textContent).toBe('Actual text output here');
        expect(result.thinkingContent).toBe('Inline reasoning content here');
        expect(result.cacheHit).toBe(false);
    });
});
