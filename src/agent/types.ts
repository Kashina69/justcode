import { ToolCall } from '../providers/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { SafetyGate } from '../safety/gate.js';
import { BackupManager } from '../safety/backup.js';
import { AppConfig } from '../config/index.js';

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
  type: 'text' | 'tool_start' | 'tool_end' | 'stats' | 'thinking' | 'request_start' | 'request_end';
  content?: string;
  toolCall?: ToolCall;
  result?: string;
  stats?: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    modelLatencyMs: number;
    toolExecutionLatencyMs: number;
  };
}

export type ProgressCallback = (event: ProgressEvent) => void;
