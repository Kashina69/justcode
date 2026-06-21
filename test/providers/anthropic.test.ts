import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicMessagesProvider } from '../../src/providers/anthropic.js';
import { AppConfig } from '../../src/config/index.js';

// Mock Anthropic client
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        messages: {
          create: mockCreate,
        },
      };
    }),
  };
});

describe('AnthropicMessagesProvider', () => {
  const dummyConfig: AppConfig = {
    anthropicApiKey: 'dummy-api-key',
    openaiApiKey: undefined,
    openaiEndpoint: undefined,
    modelAliases: {
      fast: { provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022' },
      smart: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
      planner: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
    },
  };

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should initialize and call complete with mapped messages and tools', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: 'Hello, this is a response.' },
        { type: 'tool_use', id: 'tool-use-id-1', name: 'read_file', input: { path: 'plan.md' } }
      ],
      usage: {
        input_tokens: 15,
        output_tokens: 25,
      },
    });

    const provider = new AnthropicMessagesProvider(dummyConfig);
    const result = await provider.complete({
      systemPrompt: 'System Instruction',
      messages: [{ role: 'user', content: 'Say hello' }],
      availableTools: [
        {
          name: 'read_file',
          description: 'Reads a file',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      modelAlias: 'smart',
    });

    // Check mapping
    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-3-5-sonnet-20241022');
    expect(callArgs.system).toEqual([
      {
        type: 'text',
        text: 'System Instruction',
        cache_control: { type: 'ephemeral' },
      },
    ]);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content[0].text).toBe('Say hello');

    // Check outputs
    expect(result.textContent).toBe('Hello, this is a response.');
    expect(result.requestedToolCalls).toHaveLength(1);
    expect(result.requestedToolCalls[0]).toEqual({
      id: 'tool-use-id-1',
      name: 'read_file',
      input: { path: 'plan.md' },
    });
    expect(result.tokenUsage).toEqual({ inputTokens: 15, outputTokens: 25 });
  });

  it('should throw error on missing API key during construction', () => {
    expect(() => {
      new AnthropicMessagesProvider({
        anthropicApiKey: undefined,
        openaiApiKey: undefined,
        openaiEndpoint: undefined,
        modelAliases: dummyConfig.modelAliases,
      });
    }).toThrow('Anthropic API Key is missing');
  });

  it('should parse thinking block and cache hit details correctly', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: 'Claude thinking content here' },
        { type: 'text', text: 'Hello, this is a response.' },
      ],
      usage: {
        input_tokens: 15,
        output_tokens: 25,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 5,
      },
    });

    const provider = new AnthropicMessagesProvider(dummyConfig);
    const result = await provider.complete({
      systemPrompt: 'System Instruction',
      messages: [{ role: 'user', content: 'Say hello' }],
      availableTools: [],
      modelAlias: 'smart',
    });

    expect(result.textContent).toBe('Hello, this is a response.');
    expect(result.thinkingContent).toBe('Claude thinking content here');
    expect(result.cacheHit).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
