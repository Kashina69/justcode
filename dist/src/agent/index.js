import fs from 'fs/promises';
import path from 'path';
import { getProviderForAlias } from '../providers/factory.js';
import { SkillLoader } from '../skills/loader.js';
import { SkillMatcher } from '../skills/matcher.js';
import { logTokenUsage } from '../memory/global.js';
import { ProjectMemoryManager } from '../memory/project.js';
import { readPromptSync, readTemplateSync } from '../config/prompts.js';
export function buildCalibrationNote(previousTurn) {
    if (!previousTurn || !previousTurn.declaredBudget)
        return '';
    return `[prior turn: declared ~${previousTurn.declaredBudget}, used ${previousTurn.actualOutputTokens}]`;
}
export class AgentOrchestrator {
    config;
    registry;
    safetyGate;
    backupManager;
    onConfirmDangerousTool;
    systemPrompt;
    projectMemory;
    skills = [];
    skillsLoaded = false;
    pinnedSkills;
    mutedSkills;
    lastTurnMetrics = null;
    cachedActiveSkills = null;
    // Template strings loaded once at construction — editable in templates/ without touching code
    planInjectionHeader;
    skillInjectionHeader;
    /**
     * Initializes the AgentOrchestrator.
     *
     * @param options Config settings including registry, safety, and app configurations.
     */
    constructor(options) {
        this.config = options.config;
        this.registry = options.registry;
        this.safetyGate = options.safetyGate;
        this.backupManager = options.backupManager;
        this.onConfirmDangerousTool = options.onConfirmDangerousTool;
        this.projectMemory = new ProjectMemoryManager(this.config);
        const platform = process.platform;
        const shellHint = platform === 'win32'
            ? 'Windows — use cmd-compatible commands (dir, del, if exist) or explicit `powershell -Command "..."` for anything else'
            : 'POSIX — use standard Unix commands (ls, rm, &&)';
        this.systemPrompt = (options.systemPrompt || readPromptSync('agent_system.txt')) + `\n\nHost: ${platform} — ${shellHint}`;
        this.pinnedSkills = options.pinnedSkills ?? new Set();
        this.mutedSkills = options.mutedSkills ?? new Set();
        this.planInjectionHeader = readTemplateSync('plan_injection_header.txt');
        this.skillInjectionHeader = readTemplateSync('manual_skill_header.txt');
    }
    /**
     * Resets the turn metrics (e.g. when resuming a session) to start calibration clean.
     */
    resetSessionState() {
        this.lastTurnMetrics = null;
        this.cachedActiveSkills = null;
    }
    /**
     * Lazy loads skills recursively.
     */
    async ensureSkillsLoaded() {
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
    async loadActivePlans() {
        const plansDir = path.join(process.cwd(), '.agent', 'plans');
        const activePlans = [];
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
        }
        catch {
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
    async runTurn(messages, onProgress, isRecursive = false) {
        const availableTools = this.registry.getToolDefinitions();
        // 1. Ensure skills are loaded
        const skillLoadStart = Date.now();
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
            }
            else if (Array.isArray(initialUserMessage.content)) {
                taskDescription = initialUserMessage.content
                    .map((b) => (b.type === 'text' ? b.text : ''))
                    .join(' ');
            }
        }
        // 5. Resolve semantically relevant skills
        const matchStart = Date.now();
        if (!isRecursive) {
            this.cachedActiveSkills = null;
        }
        if (!this.cachedActiveSkills) {
            const matcher = new SkillMatcher(this.config);
            let matchedSkills = await matcher.matchSkills(taskDescription, this.skills);
            // Apply pin/mute overrides from session state
            matchedSkills = matchedSkills.filter((s) => !this.mutedSkills.has(s.name));
            for (const pinnedName of this.pinnedSkills) {
                if (!matchedSkills.find((s) => s.name === pinnedName)) {
                    const pinned = this.skills.find((s) => s.name === pinnedName);
                    if (pinned)
                        matchedSkills.push(pinned);
                }
            }
            this.cachedActiveSkills = matchedSkills;
            if (!isRecursive) {
                const pinMuteSummary = [
                    this.pinnedSkills.size > 0 ? `+pinned:${[...this.pinnedSkills].join(',')}` : '',
                    this.mutedSkills.size > 0 ? `-muted:${[...this.mutedSkills].join(',')}` : '',
                ].filter(Boolean).join(' ');
                onProgress?.({
                    type: 'flow_event',
                    label: 'skill_match',
                    detail: `${this.skills.length} skills evaluated → ${matchedSkills.length} active` +
                        (matchedSkills.length > 0 ? ` [${matchedSkills.map((s) => s.name).join(', ')}]` : '') +
                        (pinMuteSummary ? ` ${pinMuteSummary}` : ''),
                    durationMs: Date.now() - matchStart,
                });
            }
        }
        const matchedSkills = this.cachedActiveSkills;
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
                    this.planInjectionHeader +
                    '\n\n' +
                    activePlans
                        .map((p) => `### Plan File: ".agent/plans/${p.name}.md"\n${p.content}`)
                        .join('\n\n');
        }
        if (matchedSkills.length > 0) {
            activeSystemPrompt +=
                '\n\n' +
                    this.skillInjectionHeader +
                    '\n\n' +
                    matchedSkills.map((s) => `## Skill: ${s.name}\n${s.content}`).join('\n\n');
        }
        // Resolve model alias dynamically based on query and plans
        const resolvedAlias = this.routeModelAlias(messages, activePlans.length > 0);
        const provider = getProviderForAlias(resolvedAlias, this.config);
        const resolvedModelId = this.config.modelAliases[resolvedAlias]?.modelId ?? 'claude-3-5-sonnet-20241022';
        onProgress?.({
            type: 'flow_event',
            label: 'model_route',
            detail: `→ ${resolvedAlias} (${resolvedModelId})`,
        });
        // Prepend calibration note to the last user message if available
        let activeMessages = [...messages];
        if (this.lastTurnMetrics) {
            const calibrationNote = buildCalibrationNote(this.lastTurnMetrics);
            if (calibrationNote) {
                const lastUserIdx = activeMessages.map((m) => m.role).lastIndexOf('user');
                if (lastUserIdx !== -1) {
                    const originalMsg = activeMessages[lastUserIdx];
                    const clonedMsg = { ...originalMsg };
                    if (typeof clonedMsg.content === 'string') {
                        clonedMsg.content = calibrationNote + '\n' + clonedMsg.content;
                    }
                    else if (Array.isArray(clonedMsg.content)) {
                        const contentCopy = [...clonedMsg.content];
                        const firstText = contentCopy.find((b) => b.type === 'text');
                        if (firstText && firstText.type === 'text') {
                            const idx = contentCopy.indexOf(firstText);
                            contentCopy[idx] = {
                                type: 'text',
                                text: calibrationNote + '\n' + firstText.text,
                            };
                        }
                        else {
                            contentCopy.unshift({
                                type: 'text',
                                text: calibrationNote,
                            });
                        }
                        clonedMsg.content = contentCopy;
                    }
                    activeMessages[lastUserIdx] = clonedMsg;
                }
            }
        }
        // Call the model provider (track model-only latency)
        onProgress?.({ type: 'request_start' });
        let result;
        const modelStartMs = Date.now();
        try {
            result = await provider.complete({
                systemPrompt: activeSystemPrompt,
                messages: activeMessages,
                availableTools,
                modelAlias: resolvedAlias,
            });
        }
        finally {
            onProgress?.({ type: 'request_end' });
        }
        const modelLatencyMs = Date.now() - modelStartMs;
        // Parse budget declaration from response
        const budgetMatch = result.textContent ? result.textContent.match(/^\s*\[budget:\s*(.+?)\]/i) : null;
        const declaredBudget = budgetMatch ? budgetMatch[1].trim() : null;
        // Store turn metrics for calibration of the next turn
        this.lastTurnMetrics = {
            declaredBudget,
            actualOutputTokens: result.tokenUsage.outputTokens,
        };
        // 7. Log token usage
        await logTokenUsage(resolvedModelId, result.tokenUsage.inputTokens, result.tokenUsage.outputTokens);
        // Forward thinking block if present
        if (result.thinkingContent && onProgress) {
            onProgress({
                type: 'thinking',
                content: result.thinkingContent,
            });
        }
        // Forward completion stats/metrics (model latency only — tool latency added after tool calls)
        if (onProgress) {
            onProgress({
                type: 'stats',
                stats: {
                    modelId: resolvedModelId,
                    inputTokens: result.tokenUsage.inputTokens,
                    outputTokens: result.tokenUsage.outputTokens,
                    modelLatencyMs,
                    toolExecutionLatencyMs: 0,
                    cacheHit: result.cacheHit,
                    thinkingContent: result.thinkingContent,
                    declaredBudget,
                },
            });
        }
        const conversation = [...messages];
        const assistantContent = [];
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
        // Process tool calls — track cumulative tool execution latency separately from model latency
        const toolResults = [];
        let toolExecutionLatencyMs = 0;
        for (const toolCall of result.requestedToolCalls) {
            onProgress?.({ type: 'tool_start', toolCall });
            let output;
            let isError = false;
            // Evaluate Safety Class
            const safetyCheck = this.safetyGate.classifyToolCall(toolCall.name, toolCall.input);
            onProgress?.({
                type: 'flow_event',
                label: 'tool_classify',
                detail: `${toolCall.name} → ${safetyCheck.classification}` +
                    (safetyCheck.reason ? ` (${safetyCheck.reason.slice(0, 60)})` : ''),
            });
            const toolStartMs = Date.now();
            if (safetyCheck.classification === 'dangerous') {
                const reason = safetyCheck.reason || 'Manual confirmation required';
                const confirmed = await this.onConfirmDangerousTool(toolCall, reason);
                if (!confirmed) {
                    output = `Error: Safety Blocked. Execution of "${toolCall.name}" rejected by the developer.`;
                    isError = true;
                }
                else {
                    try {
                        output = await this.registry.executeTool(toolCall.name, toolCall.input);
                    }
                    catch (err) {
                        output = `Error executing tool: ${err.message}`;
                        isError = true;
                    }
                }
            }
            else {
                // Safe or Write tool execution
                if (safetyCheck.classification === 'write' && typeof toolCall.input?.path === 'string') {
                    await this.backupManager.createBackup(toolCall.input.path);
                }
                try {
                    output = await this.registry.executeTool(toolCall.name, toolCall.input);
                }
                catch (err) {
                    output = `Error executing tool: ${err.message}`;
                    isError = true;
                }
            }
            toolExecutionLatencyMs += Date.now() - toolStartMs;
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
        return this.runTurn(conversation, onProgress, true);
    }
    /**
     * Dynamically routes the request to the most appropriate model alias.
     *
     * @param messages The conversation history.
     * @param hasActivePlans Whether there are active plans in the project.
     * @returns The resolved model alias ('fast' | 'smart' | 'planner').
     */
    routeModelAlias(messages, hasActivePlans) {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
        let userText = '';
        if (lastUserMessage) {
            if (typeof lastUserMessage.content === 'string') {
                userText = lastUserMessage.content.toLowerCase();
            }
            else if (Array.isArray(lastUserMessage.content)) {
                userText = lastUserMessage.content
                    .map((b) => (b.type === 'text' ? b.text : ''))
                    .join(' ')
                    .toLowerCase();
            }
        }
        // 1. Check if user is explicitly calling plan commands or requesting plans
        if (userText.startsWith('/plan') ||
            userText.includes('create a plan') ||
            userText.includes('draft a plan') ||
            userText.includes('critique the plan') ||
            userText.includes('architecture plan')) {
            return 'planner';
        }
        // 2. If there are active plans, we can transition to 'fast' model execution steps,
        // unless the query asks for complex architecting/refactoring.
        if (hasActivePlans) {
            if (userText.includes('refactor') ||
                userText.includes('design') ||
                userText.includes('security') ||
                userText.includes('optimize performance') ||
                userText.includes('architect')) {
                return 'smart';
            }
            return 'fast';
        }
        // 3. For simple/short conversational queries, route to fast model
        if (userText.includes('hello') ||
            userText.includes('hi ') ||
            userText.includes('explain') ||
            userText.includes('what is') ||
            userText.includes('where is') ||
            userText.length < 25) {
            return 'fast';
        }
        // 4. Default to smart model for general coding and tool-based executions
        return 'smart';
    }
}
