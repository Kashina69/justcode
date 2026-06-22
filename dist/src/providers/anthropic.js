import Anthropic from '@anthropic-ai/sdk';
import { SessionLogger } from '../memory/logger.js';
export class AnthropicMessagesProvider {
    anthropic;
    config;
    /**
     * Initializes the Anthropic provider.
     *
     * @param config The application configuration containing the API key and model aliases.
     */
    constructor(config) {
        const apiKey = config.anthropicApiKey;
        if (!apiKey) {
            throw new Error('Anthropic API Key is missing. Please set the ANTHROPIC_API_KEY environment variable.');
        }
        const anthropicParams = { apiKey };
        if (config.anthropicEndpoint) {
            anthropicParams.baseURL = config.anthropicEndpoint;
        }
        this.anthropic = new Anthropic(anthropicParams);
        this.config = config;
    }
    /**
     * Translates the completion request to Anthropic's Messages API format, executes it,
     * measures duration, extracts thinking/caching stats, writes session logs,
     * and maps the response back to a CompletionResult.
     *
     * @param request The CompletionRequest settings.
     * @returns A promise resolving to a CompletionResult.
     */
    async complete(request) {
        const logger = SessionLogger.getInstance();
        // Resolve the real model ID using the config alias map
        const modelConfig = this.config.modelAliases[request.modelAlias];
        const modelId = modelConfig ? modelConfig.modelId : 'claude-3-5-sonnet-20241022';
        // Map messages
        const mappedMessages = this.mapMessages(request.messages);
        // Apply prompt caching to messages
        const cachedMessages = this.applyPromptCachingToMessages(mappedMessages);
        // Map tools
        const mappedTools = this.mapTools(request.availableTools);
        // Prepare system prompt with prompt caching
        const systemPromptBlocks = [
            {
                type: 'text',
                text: request.systemPrompt,
                cache_control: { type: 'ephemeral' }
            }
        ];
        const params = {
            model: modelId,
            max_tokens: 4000,
            system: systemPromptBlocks,
            messages: cachedMessages,
        };
        // If using a model that supports thinking (like Claude 3.7 Sonnet), enable thinking parameter.
        // Anthropic requires max_tokens to be larger than thinking budget.
        if (modelId.includes('3-7') || modelId.includes('3.7')) {
            params.thinking = {
                type: 'enabled',
                budget_tokens: 2000
            };
            params.max_tokens = 8000;
        }
        if (mappedTools.length > 0) {
            params.tools = mappedTools;
        }
        logger.logRequest(`Anthropic API (${modelId})`, params);
        const startTime = Date.now();
        let response;
        try {
            response = await this.anthropic.messages.create(params);
        }
        catch (error) {
            logger.logError(`Anthropic Request Failed: ${error.message}`, error);
            throw error;
        }
        const durationMs = Date.now() - startTime;
        logger.logResponse(response, durationMs);
        // Extract text content, thinking blocks, and tool calls
        let textContent = '';
        let thinkingContent = '';
        const requestedToolCalls = [];
        for (const contentBlock of response.content) {
            if (contentBlock.type === 'text') {
                textContent += contentBlock.text;
            }
            else if (contentBlock.type === 'tool_use') {
                requestedToolCalls.push({
                    id: contentBlock.id,
                    name: contentBlock.name,
                    input: contentBlock.input,
                });
            }
            else if (contentBlock.type === 'thinking') {
                thinkingContent += contentBlock.thinking || '';
            }
        }
        // Get token usage and cache details
        const usage = response.usage;
        const tokenUsage = {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
        };
        const cacheHit = (usage.cache_read_input_tokens || 0) > 0;
        return {
            textContent,
            requestedToolCalls,
            tokenUsage,
            thinkingContent: thinkingContent || undefined,
            durationMs,
            cacheHit,
        };
    }
    /**
     * Maps internal messages to Anthropic's SDK message parameters.
     *
     * @param messages List of internal ConversationMessage objects.
     * @returns Array of Anthropic message parameters.
     */
    mapMessages(messages) {
        return messages.map((msg) => {
            if (typeof msg.content === 'string') {
                return {
                    role: msg.role,
                    content: msg.content,
                };
            }
            const contentBlocks = msg.content.map((block) => {
                switch (block.type) {
                    case 'text':
                        return {
                            type: 'text',
                            text: block.text,
                        };
                    case 'tool_use':
                        return {
                            type: 'tool_use',
                            id: block.id,
                            name: block.name,
                            input: block.input,
                        };
                    case 'tool_result':
                        return {
                            type: 'tool_result',
                            tool_use_id: block.toolUseId,
                            content: block.content,
                            is_error: block.isError ?? false,
                        };
                    default:
                        throw new Error(`Unsupported content block type: ${block.type}`);
                }
            });
            return {
                role: msg.role,
                content: contentBlocks,
            };
        });
    }
    /**
     * Injects prompt caching markers into the messages list (the last user message).
     *
     * @param messages Anthropic Message parameters.
     * @returns Modified list with cache control markers.
     */
    applyPromptCachingToMessages(messages) {
        if (messages.length === 0) {
            return messages;
        }
        const updated = [...messages];
        // Find the last user message to attach a cache control block
        for (let i = updated.length - 1; i >= 0; i--) {
            const msg = updated[i];
            if (msg.role === 'user') {
                if (typeof msg.content === 'string') {
                    msg.content = [
                        {
                            type: 'text',
                            text: msg.content,
                            cache_control: { type: 'ephemeral' }
                        }
                    ];
                }
                else if (Array.isArray(msg.content) && msg.content.length > 0) {
                    const contentArray = [...msg.content];
                    const lastIdx = contentArray.length - 1;
                    contentArray[lastIdx] = {
                        ...contentArray[lastIdx],
                        cache_control: { type: 'ephemeral' }
                    };
                    msg.content = contentArray;
                }
                break; // Only cache the last user message prefix
            }
        }
        return updated;
    }
    /**
     * Maps internal tool definitions to Anthropic's API tool parameters.
     *
     * @param tools List of internal ToolDefinition objects.
     * @returns Array of Anthropic tool parameters.
     */
    mapTools(tools) {
        return tools.map((tool, idx) => {
            const mappedTool = {
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            };
            // Add cache control on the last tool definition to keep tools cached
            if (idx === tools.length - 1) {
                mappedTool.cache_control = { type: 'ephemeral' };
            }
            return mappedTool;
        });
    }
}
