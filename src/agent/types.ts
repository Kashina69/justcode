import { ConversationMessage, ToolCall } from '../providers/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { SafetyGate } from '../safety/gate.js';
import { BackupManager } from '../safety/backup.js';
import { AppConfig } from '../config/index.js';

export interface TurnMetrics {
  declaredBudget: string | null;
  actualOutputTokens: number;
}

export interface AgentOptions {
  config: AppConfig;
  registry: ToolRegistry;
  safetyGate: SafetyGate;
  backupManager: BackupManager;
  onConfirmDangerousTool: (toolCall: ToolCall, reason: string) => Promise<boolean>;
  systemPrompt?: string;
  pinnedSkills?: Set<string>;
  mutedSkills?: Set<string>;
}

export interface ProgressEvent {
  type:
    | 'text'
    | 'tool_start'
    | 'tool_end'
    | 'stats'
    | 'thinking'
    | 'request_start'
    | 'request_end'
    | 'flow_event';
  content?: string;
  toolCall?: ToolCall;
  result?: string;
  label?: string;
  detail?: string;
  durationMs?: number;
  stats?: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    modelLatencyMs?: number;
    toolExecutionLatencyMs?: number;
    cacheHit?: boolean;
    thinkingContent?: string;
    declaredBudget?: string | null;
  };
}

export type ProgressCallback = (progress: ProgressEvent) => void;
