import fs from 'fs/promises';
import path from 'path';
import {
  ConversationMessage,
  ToolCall,
  MessageContentBlock,
  ModelAlias,
} from '../providers/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { BackupManager } from '../safety/backup.js';
import { getProviderForAlias } from '../providers/factory.js';
import { AppConfig } from '../config/index.js';
import { loadSkills } from '../skills/loader.js';
import { matchSkills as matchSkillsDeterministic } from '../skills/matcher.js';
import { Skill } from '../skills/types.js';
import { logTokenUsage } from '../memory/global.js';
import { loadMemory } from '../memory/project.js';
import { prompts } from '../config/prompts.js';
import { classifyToolCall } from '../safety/gate.js';
import { getTasteContext } from '../cli/taste.js';
import { AgentOptions, ProgressCallback } from './types.js';

export class AgentOrchestrator {
  readonly config: AppConfig;
  readonly registry: ToolRegistry;
  readonly projectRoot: string;
  readonly backupManager: BackupManager;
  readonly onConfirmDangerousTool: (toolCall: ToolCall, reason: string) => Promise<boolean>;
  private systemPrompt: string;
  private modelAlias: ModelAlias = 'fast';
  private skills: Skill[] = [];
  private pinnedSkills: Set<string>;
  private mutedSkills: Set<string>;

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.registry = options.registry;
    this.projectRoot = options.projectRoot;
    this.backupManager = options.backupManager;
    this.onConfirmDangerousTool = options.onConfirmDangerousTool;
    this.pinnedSkills = options.pinnedSkills ?? new Set();
    this.mutedSkills = options.mutedSkills ?? new Set();
    this.systemPrompt = buildSystemPrompt(options.systemPrompt);
  }

  setModel(alias: ModelAlias): void {
    this.modelAlias = alias;
  }

  async runTurn(messages: ConversationMessage[], onProgress?: ProgressCallback): Promise<ConversationMessage[]> {
    if (this.skills.length === 0) {
      this.skills = await loadSkills(path.join(process.cwd(), 'skills'));
    }

    let matchedSkills = matchSkillsDeterministic(this.skills);
    matchedSkills = matchedSkills.filter(s => !this.mutedSkills.has(s.name));
    for (const pinned of this.pinnedSkills) {
      if (!matchedSkills.find(s => s.name === pinned)) {
        const skill = this.skills.find(s => s.name === pinned);
        if (skill) matchedSkills.push(skill);
      }
    }
    const memoryText = await loadMemory(this.projectRoot);
    const activePlans = await loadActivePlans();
    const tasteText = await getTasteContext(this.projectRoot);
    const systemPrompt = injectContext(this.systemPrompt, memoryText, activePlans, matchedSkills, tasteText);

    const availableTools = this.registry.getToolDefinitions();
    const provider = getProviderForAlias(this.modelAlias, this.config);
    const modelId = this.config.modelAliases[this.modelAlias]?.modelId ?? 'claude-3-5-sonnet-20241022';

    onProgress?.({ type: 'request_start' });
    const modelStart = Date.now();
    const result = await provider.complete({
      systemPrompt,
      messages,
      availableTools,
      modelAlias: this.modelAlias,
    });
    onProgress?.({ type: 'request_end' });
    const modelLatencyMs = Date.now() - modelStart;

    await logTokenUsage(modelId, result.tokenUsage.inputTokens, result.tokenUsage.outputTokens);

    const conversation = [...messages];
    const assistantContent: MessageContentBlock[] = [];
    if (result.textContent) {
      assistantContent.push({ type: 'text', text: result.textContent });
    }
    for (const call of result.requestedToolCalls) {
      assistantContent.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
    }
    conversation.push({ role: 'assistant', content: assistantContent });

    if (result.thinkingContent) onProgress?.({ type: 'thinking', content: result.thinkingContent });
    if (result.textContent) onProgress?.({ type: 'text', content: result.textContent });
    onProgress?.({
      type: 'stats',
      stats: { modelId, inputTokens: result.tokenUsage.inputTokens, outputTokens: result.tokenUsage.outputTokens, modelLatencyMs, toolExecutionLatencyMs: 0 },
    });

    if (result.requestedToolCalls.length === 0) return conversation;

    let toolExecutionLatencyMs = 0;
    const toolResults: MessageContentBlock[] = [];
    for (const toolCall of result.requestedToolCalls) {
      onProgress?.({ type: 'tool_start', toolCall });
      const toolStart = Date.now();
      const { output, isError } = await executeToolCall(toolCall, this.registry, this.backupManager, this.onConfirmDangerousTool);
      toolExecutionLatencyMs += Date.now() - toolStart;
      onProgress?.({ type: 'tool_end', toolCall, result: output });
      toolResults.push({ type: 'tool_result', toolUseId: toolCall.id, content: output, isError });
    }
    conversation.push({ role: 'user', content: toolResults });

    return this.runTurn(conversation, onProgress);
  }
}

function buildSystemPrompt(userPrompt: string | undefined): string {
  const platform = process.platform;
  const shellHint = platform === 'win32'
    ? 'Windows — use cmd-compatible commands (dir, del, if exist) or explicit `powershell -Command "..."` for anything else'
    : 'POSIX — use standard Unix commands (ls, rm, &&)';

  let prompt = userPrompt || prompts.get('agent_system');
  try {
    prompt += `\n\n${prompts.get('ask_user_guidance')}`;
  } catch { /* no guidance file */ }
  return `${prompt}\n\nHost: ${platform} \u2014 ${shellHint}`;
}

async function loadActivePlans(): Promise<{ name: string; content: string }[]> {
  const plansDir = path.join(process.cwd(), '.agent', 'plans');
  try {
    const files = await fs.readdir(plansDir, { withFileTypes: true });
    const result: { name: string; content: string }[] = [];
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const content = await fs.readFile(path.join(plansDir, file.name), 'utf-8');
        result.push({ name: file.name.replace(/\.md$/, ''), content });
      }
    }
    return result;
  } catch {
    return [];
  }
}

function injectContext(
  basePrompt: string,
  memoryText: string,
  activePlans: { name: string; content: string }[],
  matchedSkills: Skill[],
  tasteText: string,
): string {
  let prompt = basePrompt;

  if (memoryText) {
    prompt += `\n\n## Historical Project Decisions (Project Memory)\n${memoryText}`;
  }

  if (tasteText) {
    prompt += `\n\n${tasteText}`;
  }

  if (activePlans.length > 0) {
    const header = prompts.get('plan_injection_header');
    prompt += `\n\n${header}\n\n`;
    for (const plan of activePlans) {
      prompt += `### Plan File: ".agent/plans/${plan.name}.md"\n${plan.content}\n\n`;
    }
  }

  if (matchedSkills.length > 0) {
    const header = prompts.get('manual_skill_header');
    prompt += `\n\n${header}\n\n`;
    for (const skill of matchedSkills) {
      prompt += `## Skill: ${skill.name}\n${skill.content}\n\n`;
    }
  }

  return prompt;
}

async function executeToolCall(
  toolCall: ToolCall,
  registry: ToolRegistry,
  backupManager: BackupManager,
  onConfirmDangerousTool: (toolCall: ToolCall, reason: string) => Promise<boolean>,
): Promise<{ output: string; isError: boolean }> {
  const { classification, reason } = classifyToolCall(toolCall.name, toolCall.input);

  if (classification === 'dangerous') {
    const confirmed = await onConfirmDangerousTool(toolCall, reason || 'Manual confirmation required');
    if (!confirmed) {
      return { output: `Error: Safety Blocked. Execution of "${toolCall.name}" rejected by the developer.`, isError: true };
    }
  }

  if (classification === 'write' && typeof toolCall.input?.path === 'string') {
    await backupManager.createBackup(toolCall.input.path);
  }

  try {
    return { output: await registry.executeTool(toolCall.name, toolCall.input), isError: false };
  } catch (err: any) {
    return { output: `Error executing tool: ${err.message}`, isError: true };
  }
}
