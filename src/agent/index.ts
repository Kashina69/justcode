import fs from 'fs/promises';
import path from 'path';
import {
  ConversationMessage,
  ToolCall,
  MessageContentBlock,
  ToolResultBlock,
  ModelAlias
} from '../providers/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { SafetyGate } from '../safety/gate.js';
import { BackupManager } from '../safety/backup.js';
import { getProviderForAlias } from '../providers/factory.js';
import { AppConfig } from '../config/index.js';
import { SkillLoader } from '../skills/loader.js';
import { SkillMatcher } from '../skills/matcher.js';
import { Skill } from '../skills/types.js';
import { logTokenUsage } from '../memory/global.js';
import { ProjectMemoryManager } from '../memory/project.js';
import { readPromptSync } from '../config/prompts.js';

export interface AgentOptions {
  config: AppConfig;
  registry: ToolRegistry;
  safetyGate: SafetyGate;
  backupManager: BackupManager;
  onConfirmDangerousTool: (toolCall: ToolCall, reason: string) => Promise<boolean>;
  systemPrompt?: string;
}

export class AgentOrchestrator {
  private config: AppConfig;
  private registry: ToolRegistry;
  private safetyGate: SafetyGate;
  private backupManager: BackupManager;
  private onConfirmDangerousTool: (toolCall: ToolCall, reason: string) => Promise<boolean>;
  private systemPrompt: string;
  private projectMemory: ProjectMemoryManager;
  private skills: Skill[] = [];
  private skillsLoaded = false;

  /**
   * Initializes the AgentOrchestrator.
   * 
   * @param options Config settings including registry, safety, and app configurations.
   */
  constructor(options: AgentOptions) {
    this.config = options.config;
    this.registry = options.registry;
    this.safetyGate = options.safetyGate;
    this.backupManager = options.backupManager;
    this.onConfirmDangerousTool = options.onConfirmDangerousTool;
    this.projectMemory = new ProjectMemoryManager(this.config);
    this.systemPrompt = options.systemPrompt || readPromptSync('agent_system.txt');
  }

  /**
   * Lazy loads skills recursively.
   */
  private async ensureSkillsLoaded(): Promise<void> {
    if (this.skillsLoaded) {
      return;
    }
    const loader = new SkillLoader();
    this.skills = await loader.loadSkills();
    this.skillsLoaded = true;
  }

  /**
   * Scans the .agent/plans/ directory for active plans to append to system prompts.
   * 
   * @returns Array of active plan details.
   */
  private async loadActivePlans(): Promise<{ name: string; content: string }[]> {
    const plansDir = path.join(process.cwd(), '.agent', 'plans');
    const activePlans: { name: string; content: string }[] = [];
    try {
      const files = await fs.readdir(plansDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const planPath = path.join(plansDir, file.name);
          const content = await fs.readFile(planPath, 'utf-8');
          activePlans.push({
            name: file.name.replace(/\.md$/, ''),
            content,
          });
        }
      }
    } catch {
      // Ignore missing plans folder
    }
    return activePlans;
  }

  /**
   * Runs a single execution turn. Loads active plans, memory logs, and dynamic provider mappings.
   * 
   * @param messages The current conversation history.
   * @param onProgress Callback invoked to notify the caller of agent actions/progress.
   * @returns A promise resolving to the updated conversation history.
   */
  async runTurn(
    messages: ConversationMessage[],
    onProgress?: (progress: {
      type: 'text' | 'tool_start' | 'tool_end' | 'stats' | 'thinking' | 'request_start' | 'request_end';
      content?: string;
      toolCall?: ToolCall;
      result?: string;
      stats?: {
        modelId: string;
        inputTokens: number;
        outputTokens: number;
        durationMs?: number;
        cacheHit?: boolean;
        thinkingContent?: string;
      };
    }) => void
  ): Promise<ConversationMessage[]> {
    const availableTools = this.registry.getToolDefinitions();

    // 1. Ensure skills are loaded
    await this.ensureSkillsLoaded();

    // 2. Load historical project decisions memory
    const projectMemoryText = await this.projectMemory.loadMemory();

    // 3. Load active plans
    const activePlans = await this.loadActivePlans();

    // 4. Extract user query task description from history
    const initialUserMessage = messages.find((m) => m.role === 'user');
    let taskDescription = '';
    if (initialUserMessage) {
      if (typeof initialUserMessage.content === 'string') {
        taskDescription = initialUserMessage.content;
      } else if (Array.isArray(initialUserMessage.content)) {
        taskDescription = initialUserMessage.content
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join(' ');
      }
    }

    // 5. Resolve semantically relevant skills
    const matcher = new SkillMatcher(this.config);
    const matchedSkills = await matcher.matchSkills(taskDescription, this.skills);

    // 6. Inject project memory, active plans, and matched skills into system prompt
    let activeSystemPrompt = this.systemPrompt;
    if (projectMemoryText) {
      activeSystemPrompt +=
        '\n\n' +
        '## Historical Project Decisions (Project Memory)\n' +
        'The following is a prose log of past decisions and context for this project. ' +
        'Keep these decisions in mind and ensure your choices do not conflict with them:\n' +
        projectMemoryText;
    }

    if (activePlans.length > 0) {
      activeSystemPrompt +=
        '\n\n' +
        '## Active Implementation Plan(s)\n' +
        'You are executing the following plan details. ' +
        'Check off steps in these markdown documents as you complete them by replacing "- [ ]" with "- [x]" using your edit_file tool. ' +
        'Focus on the next uncompleted step. Do not deviate from these steps without explicit developer instructions:\n\n' +
        activePlans
          .map((p) => `### Plan File: ".agent/plans/${p.name}.md"\n${p.content}`)
          .join('\n\n');
    }

    if (matchedSkills.length > 0) {
      activeSystemPrompt +=
        '\n\n' +
        'You MUST consult and follow every skill listed below whose description matches the current task. ' +
        'This is not optional. If a skill\'s instructions conflict with a user request, follow the skill and tell the user why.\n\n' +
        matchedSkills.map((s) => `## Skill: ${s.name}\n${s.content}`).join('\n\n');
    }

    // Resolve model alias dynamically based on query and plans
    const resolvedAlias = this.routeModelAlias(messages, activePlans.length > 0);
    const provider = getProviderForAlias(resolvedAlias, this.config);

    // Call the model provider
    onProgress?.({ type: 'request_start' });
    let result;
    try {
      result = await provider.complete({
        systemPrompt: activeSystemPrompt,
        messages,
        availableTools,
        modelAlias: resolvedAlias,
      });
    } finally {
      onProgress?.({ type: 'request_end' });
    }

    // 7. Log token usage
    const modelConfig = this.config.modelAliases[resolvedAlias];
    const resolvedModelId = modelConfig ? modelConfig.modelId : 'claude-3-5-sonnet-20241022';
    await logTokenUsage(
      resolvedModelId,
      result.tokenUsage.inputTokens,
      result.tokenUsage.outputTokens
    );

    // Forward thinking block if present
    if (result.thinkingContent && onProgress) {
      onProgress({
        type: 'thinking',
        content: result.thinkingContent,
      });
    }

    // Forward completion stats/metrics
    if (onProgress) {
      onProgress({
        type: 'stats',
        stats: {
          modelId: resolvedModelId,
          inputTokens: result.tokenUsage.inputTokens,
          outputTokens: result.tokenUsage.outputTokens,
          durationMs: result.durationMs,
          cacheHit: result.cacheHit,
          thinkingContent: result.thinkingContent,
        },
      });
    }

    const conversation = [...messages];

    const assistantContent: MessageContentBlock[] = [];
    if (result.textContent) {
      assistantContent.push({
        type: 'text',
        text: result.textContent,
      });
      onProgress?.({ type: 'text', content: result.textContent });
    }

    if (result.requestedToolCalls.length > 0) {
      for (const call of result.requestedToolCalls) {
        assistantContent.push({
          type: 'tool_use',
          id: call.id,
          name: call.name,
          input: call.input,
        });
      }
    }

    // Append assistant's turn response to history
    conversation.push({
      role: 'assistant',
      content: assistantContent,
    });

    // If no tools were requested, we are done with this turn.
    if (result.requestedToolCalls.length === 0) {
      return conversation;
    }

    // Process tool calls
    const toolResults: MessageContentBlock[] = [];

    for (const toolCall of result.requestedToolCalls) {
      onProgress?.({ type: 'tool_start', toolCall });

      let output: string;
      let isError = false;

      // Evaluate Safety Class
      const safetyCheck = this.safetyGate.classifyToolCall(toolCall.name, toolCall.input);

      if (safetyCheck.classification === 'dangerous') {
        const reason = safetyCheck.reason || 'Manual confirmation required';
        const confirmed = await this.onConfirmDangerousTool(toolCall, reason);

        if (!confirmed) {
          output = `Error: Safety Blocked. Execution of "${toolCall.name}" rejected by the developer.`;
          isError = true;
        } else {
          // Execution confirmed
          try {
            output = await this.registry.executeTool(toolCall.name, toolCall.input);
          } catch (err: any) {
            output = `Error executing tool: ${err.message}`;
            isError = true;
          }
        }
      } else {
        // Safe or Write tool execution
        if (safetyCheck.classification === 'write' && typeof toolCall.input?.path === 'string') {
          // Backup target file first
          await this.backupManager.createBackup(toolCall.input.path);
        }

        try {
          output = await this.registry.executeTool(toolCall.name, toolCall.input);
        } catch (err: any) {
          output = `Error executing tool: ${err.message}`;
          isError = true;
        }
      }

      onProgress?.({ type: 'tool_end', toolCall, result: output });

      toolResults.push({
        type: 'tool_result',
        toolUseId: toolCall.id,
        content: output,
        isError,
      });
    }

    // Append tool results as a user response containing the result blocks
    conversation.push({
      role: 'user',
      content: toolResults,
    });

    // Recurse to let the assistant inspect the tool results and continue
    return this.runTurn(conversation, onProgress);
  }

  /**
   * Dynamically routes the request to the most appropriate model alias.
   * 
   * @param messages The conversation history.
   * @param hasActivePlans Whether there are active plans in the project.
   * @returns The resolved model alias ('fast' | 'smart' | 'planner').
   */
  public routeModelAlias(messages: ConversationMessage[], hasActivePlans: boolean): ModelAlias {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    let userText = '';
    if (lastUserMessage) {
      if (typeof lastUserMessage.content === 'string') {
        userText = lastUserMessage.content.toLowerCase();
      } else if (Array.isArray(lastUserMessage.content)) {
        userText = lastUserMessage.content
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join(' ')
          .toLowerCase();
      }
    }

    // 1. Check if user is explicitly calling plan commands or requesting plans
    if (
      userText.startsWith('/plan') ||
      userText.includes('create a plan') ||
      userText.includes('draft a plan') ||
      userText.includes('critique the plan') ||
      userText.includes('architecture plan')
    ) {
      return 'planner';
    }

    // 2. If there are active plans, we can transition to 'fast' model execution steps,
    // unless the query asks for complex architecting/refactoring.
    if (hasActivePlans) {
      if (
        userText.includes('refactor') ||
        userText.includes('design') ||
        userText.includes('security') ||
        userText.includes('optimize performance') ||
        userText.includes('architect')
      ) {
        return 'smart';
      }
      return 'fast';
    }

    // 3. For simple/short conversational queries, route to fast model
    if (
      userText.includes('hello') ||
      userText.includes('hi ') ||
      userText.includes('explain') ||
      userText.includes('what is') ||
      userText.includes('where is') ||
      userText.length < 25
    ) {
      return 'fast';
    }

    // 4. Default to smart model for general coding and tool-based executions
    return 'smart';
  }
}
