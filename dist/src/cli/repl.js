import { colors } from './colors.js';
import { estimateCost } from './cost.js';
import { SessionLogger } from '../memory/logger.js';
import { BashTool } from '../tools/bash/index.js';
import { handleCommand } from './command-dispatcher.js';
import { COLLAPSE_THRESHOLD } from './constants.js';
import fs from 'fs';
import path from 'path';
/**
 * Creates the dangerous tool confirmation handler.
 *
 * @param context The active CLI context.
 * @returns Confirm function callback.
 */
export const onConfirmDangerousTool = (context) => {
    return (toolCall, reason) => {
        if (context.spinner.active()) {
            context.spinner.stop();
        }
        return new Promise((resolve) => {
            console.log(`\n${colors.bold}${colors.yellow}⚠️  [SAFETY WARNING] A dangerous action has been requested:${colors.reset}`);
            console.log(`${colors.bold}Reason:${colors.reset} ${reason}`);
            console.log(`${colors.bold}Tool:${colors.reset}   ${toolCall.name}`);
            console.log(`${colors.bold}Input:${colors.reset}  ${JSON.stringify(toolCall.input, null, 2)}`);
            context.rl.question('\nDo you want to allow this action? (y/N): ', (answer) => {
                const approved = answer.trim().toLowerCase() === 'y';
                if (approved) {
                    console.log(`${colors.bold}${colors.green}✅ Action approved.${colors.reset}\n`);
                    resolve(true);
                }
                else {
                    console.log(`${colors.bold}${colors.red}❌ Action rejected.${colors.reset}\n`);
                    resolve(false);
                }
            });
        });
    };
};
/**
 * Summarizes the session, writes memory history, and terminates the CLI process.
 *
 * @param context The active CLI context.
 */
export const saveSessionMemoryAndExit = async (context) => {
    if (context.spinner.active()) {
        context.spinner.stop();
    }
    if (context.conversationHistory.length > 0) {
        console.log('\n💾 Summarizing session and updating project memory...');
        try {
            const summary = await context.projectMemory.createSessionSummary(context.conversationHistory);
            await context.projectMemory.saveSessionSummary(summary);
            await context.projectMemory.appendMemory(summary);
            await context.sessionManager.updateSessionSummary(context.sessionId, summary);
            await context.sessionManager.saveSessionHistory(context.sessionId, context.conversationHistory);
            console.log('✅ Session summary saved to .agent/sessions/ and appended to .agent/memory.md.');
        }
        catch (err) {
            console.error('⚠️  Failed to save project memory:', err.message || err);
        }
    }
    BashTool.cleanup();
    console.log('Goodbye!');
    process.exit(0);
};
/**
 * Processes the user's prompt to check for @skillname pinning, !@skillname muting, and @filepath context injection.
 *
 * @param context The active CLI context.
 * @param input The raw developer prompt.
 * @returns The resolved prompt containing injected file contexts.
 */
export const processUserPrompt = async (context, input) => {
    const tokens = input.split(/\s+/);
    const fileContexts = [];
    for (const token of tokens) {
        // 1. Mute skill: !@skillname
        if (token.startsWith('!@')) {
            const potentialName = token.slice(2).replace(/[.,?!;:]$/, '');
            const exactSkill = context.skillNames.find((s) => s.toLowerCase() === potentialName.toLowerCase());
            if (exactSkill) {
                context.pinnedSkills.delete(exactSkill);
                context.mutedSkills.add(exactSkill);
                console.log(`\n🔇 Skill "${exactSkill}" is now muted for this session.`);
            }
            continue;
        }
        // 2. Pin skill or inject file: @name
        if (token.startsWith('@')) {
            const potentialName = token.slice(1).replace(/[.,?!;:]$/, '');
            // Check if it matches a skill
            const exactSkill = context.skillNames.find((s) => s.toLowerCase() === potentialName.toLowerCase());
            if (exactSkill) {
                context.mutedSkills.delete(exactSkill);
                context.pinnedSkills.add(exactSkill);
                console.log(`\n📌 Skill "${exactSkill}" is now pinned for this session.`);
                continue;
            }
            // Check if it is a file path, possibly with line numbers (e.g. @src/index.ts:10-20 or @src/index.ts:5)
            const lastColonIdx = potentialName.lastIndexOf(':');
            let filePath = potentialName;
            let lineRange = '';
            if (lastColonIdx !== -1) {
                const potentialLines = potentialName.slice(lastColonIdx + 1);
                if (/^\d+(-\d+)?$/.test(potentialLines)) {
                    filePath = potentialName.slice(0, lastColonIdx);
                    lineRange = potentialLines;
                }
            }
            const resolvedPath = path.resolve(process.cwd(), filePath);
            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
                try {
                    const content = fs.readFileSync(resolvedPath, 'utf-8');
                    const lines = content.split('\n');
                    let selectedContent = '';
                    let rangeText = '';
                    if (lineRange) {
                        if (lineRange.includes('-')) {
                            const [startStr, endStr] = lineRange.split('-');
                            const start = Math.max(1, parseInt(startStr, 10));
                            const end = Math.min(lines.length, parseInt(endStr, 10));
                            selectedContent = lines.slice(start - 1, end).join('\n');
                            rangeText = ` (lines ${start}-${end})`;
                        }
                        else {
                            const lineNum = Math.max(1, Math.min(lines.length, parseInt(lineRange, 10)));
                            selectedContent = lines[lineNum - 1];
                            rangeText = ` (line ${lineNum})`;
                        }
                    }
                    else {
                        selectedContent = content;
                    }
                    fileContexts.push(`### File Context: ${filePath}${rangeText}\n\`\`\`\n${selectedContent}\n\`\`\``);
                    console.log(`\n📂 Injected context from: ${filePath}${rangeText}`);
                }
                catch (err) {
                    console.warn(`\n⚠️ Failed to read file context at "${filePath}": ${err.message}`);
                }
            }
        }
    }
    if (fileContexts.length > 0) {
        return `${input}\n\n[Injected File Contexts]\n${fileContexts.join('\n\n')}`;
    }
    return input;
};
/**
 * Builds the interactive developer-to-agent prompt loop.
 *
 * @param context The active CLI context.
 * @returns The prompt loop trigger function.
 */
export const promptUser = (context) => {
    const loop = () => {
        context.rl.question('\n👤 You > ', async (input) => {
            const trimmedInput = input.trim();
            if (!trimmedInput) {
                loop();
                return;
            }
            const commandResult = await handleCommand(context, trimmedInput);
            if (commandResult === 'sync') {
                loop();
                return;
            }
            if (commandResult === 'async') {
                return;
            }
            let userQuery = trimmedInput;
            if (trimmedInput.toLowerCase().startsWith('/analyze') || trimmedInput.toLowerCase().startsWith('/anyalize')) {
                console.log('🔍 Initiating codebase analysis...');
                userQuery = `${trimmedInput} - Analyze this codebase and produce project-overview.md, folder-structure.md, and code-conventions.md inside a top-level agent/ folder.`;
            }
            // Preprocess user prompt for skill pin/mute and file context injections
            userQuery = await processUserPrompt(context, userQuery);
            context.conversationHistory.push({
                role: 'user',
                content: userQuery,
            });
            try {
                context.conversationHistory = await context.orchestrator.runTurn(context.conversationHistory, (progress) => {
                    if (progress.type === 'request_start') {
                        context.spinner.start('🤖 AI is thinking...');
                    }
                    else if (progress.type === 'request_end') {
                        if (context.spinner.active()) {
                            context.spinner.stop();
                        }
                    }
                    else if (progress.type === 'flow_event') {
                        if (context.debugMode) {
                            if (context.spinner.active())
                                context.spinner.stop();
                            const dur = progress.durationMs != null
                                ? ` ${colors.dim}(${progress.durationMs}ms)${colors.reset}`
                                : '';
                            const label = (progress.label ?? '').padEnd(14);
                            console.log(`  ${colors.gray}›${colors.reset} ${colors.dim}${label}${colors.reset} ` +
                                `${colors.gray}${progress.detail ?? ''}${colors.reset}${dur}`);
                        }
                    }
                    else if (progress.type === 'tool_start' && progress.toolCall) {
                        if (context.spinner.active()) {
                            context.spinner.stop();
                        }
                        console.log(`${colors.dim}⚙️  [Tool] ${colors.bold}${progress.toolCall.name}${colors.reset}`, progress.toolCall.input);
                        context.spinner.start(`⚙️  Running: ${progress.toolCall.name}...`);
                    }
                    else if (progress.type === 'tool_end' && progress.toolCall) {
                        if (context.spinner.active()) {
                            context.spinner.stop();
                        }
                        const result = progress.result ?? '';
                        const lines = result.split('\n');
                        if (lines.length > COLLAPSE_THRESHOLD) {
                            context.lastCollapsedOutput = result;
                            console.log(`${colors.dim}✔️  [${progress.toolCall.name}] ` +
                                `${lines.length} lines returned  ` +
                                `${colors.yellow}(type "e" to expand)${colors.reset}`);
                        }
                        else {
                            context.lastCollapsedOutput = null;
                            const snippet = result.length > 300 ? result.substring(0, 300) + '...' : result;
                            console.log(`${colors.dim}✔️  [${progress.toolCall.name}] →\n${snippet}${colors.reset}`);
                        }
                    }
                    else if (progress.type === 'thinking' && progress.content) {
                        if (context.spinner.active())
                            context.spinner.stop();
                        console.log(`\n🧠 ${colors.bold}${colors.magenta}Thinking:${colors.reset}`);
                        console.log(`${colors.gray}${colors.dim}┌──────────────────────────────────────────────────`);
                        const thinkLines = progress.content.trim().split('\n');
                        for (const line of thinkLines) {
                            console.log(`${colors.gray}${colors.dim}│${colors.reset} ${colors.gray}${colors.italic}${line}${colors.reset}`);
                        }
                        console.log(`${colors.gray}${colors.dim}└──────────────────────────────────────────────────${colors.reset}\n`);
                    }
                    else if (progress.type === 'stats' && progress.stats) {
                        if (context.spinner.active())
                            context.spinner.stop();
                        const stats = progress.stats;
                        const modelSec = stats.modelLatencyMs != null
                            ? (stats.modelLatencyMs / 1000).toFixed(2)
                            : '0.00';
                        const toolSec = stats.toolExecutionLatencyMs != null && stats.toolExecutionLatencyMs > 0
                            ? (stats.toolExecutionLatencyMs / 1000).toFixed(2)
                            : null;
                        const speed = stats.modelLatencyMs && stats.modelLatencyMs > 0 && stats.outputTokens > 0
                            ? (stats.outputTokens / (stats.modelLatencyMs / 1000)).toFixed(1)
                            : 'N/A';
                        const cacheStatus = stats.cacheHit ? `${colors.green}HIT${colors.reset}` : `${colors.yellow}MISS${colors.reset}`;
                        const cacheStatusRaw = stats.cacheHit ? 'HIT' : 'MISS';
                        const estimatedCost = estimateCost(stats.modelId, stats.inputTokens, stats.outputTokens, stats.cacheHit);
                        context.sessionCost += estimatedCost;
                        context.sessionManager.updateStats(context.sessionId, stats.inputTokens, stats.outputTokens, estimatedCost).catch(() => { });
                        const toolLatencyNote = toolSec ? ` | Tool Time: ${toolSec}s` : '';
                        const budgetNote = stats.declaredBudget ? ` | Budget: ~${stats.declaredBudget} (used ${stats.outputTokens})` : '';
                        const cleanStatsMsg = `API stats: Model: ${stats.modelId} | Model Latency: ${modelSec}s${toolLatencyNote}${budgetNote} | Speed: ${speed} t/s | Input: ${stats.inputTokens} | Output: ${stats.outputTokens} | Cache Hit: ${cacheStatusRaw} | Cost: $${estimatedCost.toFixed(6)} USD`;
                        SessionLogger.getInstance().logSystem(cleanStatsMsg);
                        const toolLatencyDisplay = toolSec ? ` | Tool: ${colors.yellow}${toolSec}s${colors.reset}` : '';
                        const budgetDisplay = stats.declaredBudget ? ` | Budget: ~${colors.bold}${stats.declaredBudget}${colors.reset} (used ${colors.bold}${stats.outputTokens}${colors.reset})` : '';
                        console.log(`\n📊 ${colors.bold}Metrics: ${colors.reset}` +
                            `[${colors.cyan}${stats.modelId}${colors.reset}] | ` +
                            `Model: ${colors.yellow}${modelSec}s${colors.reset}${toolLatencyDisplay}${budgetDisplay} | ` +
                            `Speed: ${colors.yellow}${speed} t/s${colors.reset} | ` +
                            `Tokens: ${colors.bold}${stats.inputTokens}${colors.reset} in, ${colors.bold}${stats.outputTokens}${colors.reset} out | ` +
                            `Cache: ${cacheStatus} | ` +
                            `Cost: ${colors.green}$${estimatedCost.toFixed(6)} USD${colors.reset} | ` +
                            `Session: ${colors.green}$${context.sessionCost.toFixed(6)} USD${colors.reset}\n`);
                    }
                    else if (progress.type === 'text' && progress.content) {
                        if (context.spinner.active())
                            context.spinner.stop();
                        console.log(`${colors.bold}${colors.green}🤖 Agent > ${colors.reset}${progress.content}`);
                    }
                });
            }
            catch (err) {
                if (context.spinner.active()) {
                    context.spinner.stop();
                }
                console.error('\n❌ Error during execution:', err.message || err);
            }
            if (context.spinner.active()) {
                context.spinner.stop();
            }
            loop();
        });
    };
    return loop;
};
