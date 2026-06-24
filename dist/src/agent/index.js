import fs from 'fs/promises';
import path from 'path';
import { getProviderForAlias } from '../providers/factory.js';
import { SkillLoader } from '../skills/loader.js';
import { SkillMatcher } from '../skills/matcher.js';
import { logTokenUsage } from '../memory/global.js';
import { ProjectMemoryManager } from '../memory/project.js';
import { readPromptSync, readTemplateSync } from '../config/prompts.js';
import { buildCalibrationNote } from './calibration.js';
import { routeModelAlias } from './router.js';
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
    planInjectionHeader;
    skillInjectionHeader;
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
    resetSessionState() {
        this.lastTurnMetrics = null;
        this.cachedActiveSkills = null;
    }
    async ensureSkillsLoaded() {
        if (this.skillsLoaded)
            return;
        const loader = new SkillLoader();
        this.skills = await loader.loadSkills();
        this.skillsLoaded = true;
    }
    async loadActivePlans() {
        const plansDir = path.join(process.cwd(), '.agent', 'plans');
        const activePlans = [];
        try {
            const files = await fs.readdir(plansDir, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile() && file.name.endsWith('.md')) {
                    const planPath = path.join(plansDir, file.name);
                    const content = await fs.readFile(planPath, 'utf-8');
                    activePlans.push({ name: file.name.replace(/\.md$/, ''), content });
                }
            }
        }
        catch {
            // Ignore missing plans folder
        }
        return activePlans;
    }
    preparePromptMessages(messages) {
        if (!this.lastTurnMetrics)
            return messages;
        const calibrationNote = buildCalibrationNote(this.lastTurnMetrics);
        if (!calibrationNote)
            return messages;
        const activeMessages = [...messages];
        const lastUserIdx = activeMessages.map((m) => m.role).lastIndexOf('user');
        if (lastUserIdx === -1)
            return messages;
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
        return activeMessages;
    }
    buildActiveSystemPrompt(projectMemoryText, activePlans, matchedSkills) {
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
        return activeSystemPrompt;
    }
    async executeSingleToolCall(toolCall, onProgress) {
        let output;
        let isError = false;
        const safetyCheck = this.safetyGate.classifyToolCall(toolCall.name, toolCall.input);
        onProgress?.({
            type: 'flow_event',
            label: 'tool_classify',
            detail: `${toolCall.name} → ${safetyCheck.classification}` +
                (safetyCheck.reason ? ` (${safetyCheck.reason.slice(0, 60)})` : ''),
        });
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
        return { output, isError };
    }
    routeModelAlias(messages, hasActivePlans) {
        return routeModelAlias(messages, hasActivePlans);
    }
    async runTurn(messages, onProgress, isRecursive = false) {
        const availableTools = this.registry.getToolDefinitions();
        await this.ensureSkillsLoaded();
        const projectMemoryText = await this.projectMemory.loadMemory();
        const activePlans = await this.loadActivePlans();
        const initialUserMessage = messages.find((m) => m.role === 'user');
        let taskDescription = '';
        if (initialUserMessage) {
            if (typeof initialUserMessage.content === 'string') {
                taskDescription = initialUserMessage.content;
            }
            else if (Array.isArray(initialUserMessage.content)) {
                taskDescription = initialUserMessage.content.map((b) => (b.type === 'text' ? b.text : '')).join(' ');
            }
        }
        const matchStart = Date.now();
        if (!isRecursive) {
            this.cachedActiveSkills = null;
        }
        if (!this.cachedActiveSkills) {
            const matcher = new SkillMatcher(this.config);
            let matchedSkills = await matcher.matchSkills(taskDescription, this.skills);
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
        const activeSystemPrompt = this.buildActiveSystemPrompt(projectMemoryText, activePlans, matchedSkills);
        const resolvedAlias = routeModelAlias(messages, activePlans.length > 0);
        const provider = getProviderForAlias(resolvedAlias, this.config);
        const resolvedModelId = this.config.modelAliases[resolvedAlias]?.modelId ?? 'claude-3-5-sonnet-20241022';
        onProgress?.({
            type: 'flow_event',
            label: 'model_route',
            detail: `→ ${resolvedAlias} (${resolvedModelId})`,
        });
        const activeMessages = this.preparePromptMessages(messages);
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
        const budgetMatch = result.textContent ? result.textContent.match(/^\s*\[budget:\s*(.+?)\]/i) : null;
        const declaredBudget = budgetMatch ? budgetMatch[1].trim() : null;
        this.lastTurnMetrics = {
            declaredBudget,
            actualOutputTokens: result.tokenUsage.outputTokens,
        };
        await logTokenUsage(resolvedModelId, result.tokenUsage.inputTokens, result.tokenUsage.outputTokens);
        if (result.thinkingContent && onProgress) {
            onProgress({ type: 'thinking', content: result.thinkingContent });
        }
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
            assistantContent.push({ type: 'text', text: result.textContent });
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
        conversation.push({ role: 'assistant', content: assistantContent });
        if (result.requestedToolCalls.length === 0) {
            return conversation;
        }
        const toolResults = [];
        let toolExecutionLatencyMs = 0;
        for (const toolCall of result.requestedToolCalls) {
            onProgress?.({ type: 'tool_start', toolCall });
            const toolStartMs = Date.now();
            const { output, isError } = await this.executeSingleToolCall(toolCall, onProgress);
            toolExecutionLatencyMs += Date.now() - toolStartMs;
            onProgress?.({ type: 'tool_end', toolCall, result: output });
            toolResults.push({
                type: 'tool_result',
                toolUseId: toolCall.id,
                content: output,
                isError,
            });
        }
        conversation.push({ role: 'user', content: toolResults });
        return this.runTurn(conversation, onProgress, true);
    }
}
