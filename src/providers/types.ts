export type ModelAlias = 'fast' | 'smart' | 'planner';

export type MessageRole = 'user' | 'assistant';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type MessageContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ConversationMessage {
  role: MessageRole;
  content: string | MessageContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface CompletionRequest {
  systemPrompt: string;
  messages: ConversationMessage[];
  availableTools: ToolDefinition[];
  modelAlias: ModelAlias;
}

export interface CompletionResult {
  textContent: string;
  requestedToolCalls: ToolCall[];
  tokenUsage: { inputTokens: number; outputTokens: number };
  thinkingContent?: string;
  durationMs?: number;
  cacheHit?: boolean;
}

export interface ModelProvider {
  /**
   * Sends a prompt and messages to the LLM and returns the normalized completion result.
   * 
   * @param request The CompletionRequest details.
   * @returns A promise resolving to the CompletionResult.
   */
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
