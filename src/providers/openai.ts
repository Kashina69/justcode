import {
  ModelProvider,
  CompletionRequest,
  CompletionResult,
  ConversationMessage,
  ToolCall,
  MessageContentBlock,
  ToolDefinition
} from './types.js';
import { AppConfig } from '../config/index.js';
import { SessionLogger } from '../memory/logger.js';
import { FALLBACK_MODEL_OPENAI, DEFAULT_OPENAI_ENDPOINT } from '../config/constants.js';

export class OpenAiCompatibleProvider implements ModelProvider {
  private config: AppConfig;

  /**
   * Initializes the OpenAI compatible provider.
   * 
   * @param config The application configuration containing endpoints and API keys.
   */
  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Sends request to an OpenAI-compatible /chat/completions endpoint using standard fetch,
   * translating formats, tracking latency, parsing thinking logs, logging requests, and returning normalized outputs.
   * 
   * @param request The CompletionRequest details.
   * @returns A promise resolving to the CompletionResult.
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const logger = SessionLogger.getInstance();

    const modelConfig = this.config.modelAliases[request.modelAlias];
    const modelId = modelConfig ? modelConfig.modelId : FALLBACK_MODEL_OPENAI;

    const apiKey = this.config.openaiApiKey;
    const endpoint = this.config.openaiEndpoint || DEFAULT_OPENAI_ENDPOINT;

    // Map messages history to OpenAI payload format
    const openAiMessages = this.mapMessages(request.messages, request.systemPrompt);

    // Map tools to OpenAI payload format
    const openAiTools = this.mapTools(request.availableTools);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const payload: any = {
      model: modelId,
      messages: openAiMessages,
    };

    if (openAiTools.length > 0) {
      payload.tools = openAiTools;
    }

    logger.logRequest(`${endpoint}/chat/completions (${modelId})`, payload);
    const startTime = Date.now();

    let response: Response;
    try {
      response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error: any) {
      logger.logError(`OpenAI compatible HTTP request failed: ${error.message}`, error);
      throw error;
    }

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      logger.logError(`OpenAI API returned error status ${response.status}: ${errText}`);
      throw new Error(`OpenAI Provider HTTP Error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    logger.logResponse(data, durationMs);

    const choice = data.choices?.[0];
    let textContent = choice?.message?.content || '';
    let thinkingContent = choice?.message?.reasoning_content || '';

    // If reasoning content is empty, check if textContent has inline <think> tags (common in DeepSeek R1 routers/Ollama)
    if (!thinkingContent && textContent.includes('<think>')) {
      const startIdx = textContent.indexOf('<think>');
      const endIdx = textContent.indexOf('</think>');
      if (endIdx !== -1) {
        thinkingContent = textContent.substring(startIdx + 7, endIdx).trim();
        textContent = (textContent.substring(0, startIdx) + textContent.substring(endIdx + 8)).trim();
      }
    }

    const requestedToolCalls: ToolCall[] = [];

    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.type === 'function') {
          let parsedInput = {};
          try {
            parsedInput = JSON.parse(tc.function.arguments || '{}');
          } catch {
            // Ignore JSON parsing errors
          }
          requestedToolCalls.push({
            id: tc.id,
            name: tc.function.name,
            input: parsedInput,
          });
        }
      }
    }

    const tokenUsage = {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };

    const cacheHit = (data.usage?.prompt_tokens_details?.cached_tokens || 0) > 0;

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
   * Translates internal conversation messages to the format expected by OpenAI.
   * 
   * @param messages List of internal ConversationMessage objects.
   * @param systemPrompt The system prompt to insert at the beginning.
   * @returns Array of OpenAI messages.
   */
  private mapMessages(messages: ConversationMessage[], systemPrompt: string): any[] {
    const openAiMessages: any[] = [];

    // OpenAI models accept system prompt as a system-role message at the beginning
    openAiMessages.push({
      role: 'system',
      content: systemPrompt,
    });

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        openAiMessages.push({
          role: msg.role,
          content: msg.content,
        });
      } else {
        if (msg.role === 'assistant') {
          let text = '';
          const toolCalls: any[] = [];
          for (const block of msg.content) {
            if (block.type === 'text') {
              text += block.text;
            } else if (block.type === 'tool_use') {
              toolCalls.push({
                id: block.id,
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              });
            }
          }
          openAiMessages.push({
            role: 'assistant',
            content: text || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        } else if (msg.role === 'user') {
          const toolResults = msg.content.filter((b) => b.type === 'tool_result');
          if (toolResults.length > 0) {
            for (const block of msg.content) {
              if (block.type === 'tool_result') {
                openAiMessages.push({
                  role: 'tool',
                  tool_call_id: block.toolUseId,
                  content: block.content,
                });
              } else if (block.type === 'text') {
                openAiMessages.push({
                  role: 'user',
                  content: block.text,
                });
              }
            }
          } else {
            let text = '';
            for (const block of msg.content) {
              if (block.type === 'text') {
                text += block.text;
              }
            }
            openAiMessages.push({
              role: 'user',
              content: text,
            });
          }
        }
      }
    }

    return openAiMessages;
  }

  /**
   * Translates internal tool definitions to OpenAI's tool format.
   * 
   * @param tools List of internal ToolDefinition objects.
   * @returns Array of OpenAI tools.
   */
  private mapTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }
}
