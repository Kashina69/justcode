#!/usr/bin/env node
import readline from 'readline';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { loadAppConfig, writeAppConfig, getGlobalConfigPath, AppConfig } from '../config/index.js';
import { ToolRegistry } from '../tools/registry.js';
import { AgentOrchestrator } from '../agent/index.js';
import { SafetyGate } from '../safety/gate.js';
import { BackupManager } from '../safety/backup.js';
import { ProjectMemoryManager } from '../memory/project.js';
import { PlanningManager } from '../planning/planner.js';
import { SkillLoader } from '../skills/loader.js';
import { ConversationMessage, ToolCall } from '../providers/types.js';
import { SessionLogger } from '../memory/logger.js';
import { CliSpinner } from './spinner.js';
import { BashTool } from '../tools/bash.js';
import { SessionManager } from '../memory/session.js';
import { buildIgnoreFilter } from './gitignore-filter.js';

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (ans) => resolve(ans.trim()));
  });
}

async function runOnboarding(rl: readline.Interface): Promise<AppConfig> {
  console.log('\n======================================================');
  console.log('🤖 Welcome to justcode! Let\'s set up your API keys.');
  console.log(`Your configuration will be saved to: ${getGlobalConfigPath()}`);
  console.log('======================================================\n');

  let provider = '';
  while (provider !== 'anthropic' && provider !== 'openai-compat') {
    provider = await askQuestion(rl, 'Select AI Provider (anthropic / openai-compat): ');
    provider = provider.toLowerCase();
  }

  if (provider === 'anthropic') {
    let key = '';
    while (!key) {
      key = await askQuestion(rl, 'Enter your Anthropic API Key (sk-ant-...): ');
    }
    const endpoint = await askQuestion(rl, 'Enter custom Anthropic API Endpoint (optional, press Enter to skip): ');
    writeAppConfig({
      anthropicApiKey: key,
      anthropicEndpoint: endpoint || undefined,
      modelAliases: {
        fast: { provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022' },
        smart: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
        planner: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' }
      }
    });
  } else {
    let key = '';
    while (!key) {
      key = await askQuestion(rl, 'Enter your OpenAI-compatible API Key: ');
    }
    let endpoint = '';
    while (!endpoint) {
      endpoint = await askQuestion(rl, 'Enter the API Endpoint (e.g. https://api.deepseek.com or https://api.openai.com/v1): ');
    }
    let model = '';
    while (!model) {
      model = await askQuestion(rl, 'Enter the Model ID (e.g. deepseek-chat or gpt-4o): ');
    }
    writeAppConfig({
      openaiApiKey: key,
      openaiEndpoint: endpoint,
      modelAliases: {
        fast: { provider: 'openai-compat', modelId: model },
        smart: { provider: 'openai-compat', modelId: model },
        planner: { provider: 'openai-compat', modelId: model }
      }
    });
  }

  console.log('\n✅ Configuration saved successfully!\n');
  return loadAppConfig();
}

/**
 * Main CLI execution function. Initializes the config, provider registry, safety gate,
 * backup manager, and boots up the interactive REPL.
 */
async function main() {
  console.log('\n=== 🤖 JUSTC0D3 🤖 ===\n');

  // ── Session-scoped state ──────────────────────────────────────────────────
  const pinnedSkills = new Set<string>();    // skills always injected regardless of matcher
  const mutedSkills = new Set<string>();     // skills always excluded regardless of matcher
  let debugMode = true;                      // flow log trace — on by default, /debug off to disable
  let lastCollapsedOutput: string | null = null; // last tool output that was folded
  let skillNames: string[] = [];             // populated async on startup for tab completion

  // Build gitignore filter for tab completion
  const isIgnored = buildIgnoreFilter(process.cwd());

  // ── Tab completer ─────────────────────────────────────────────────────────
  function completer(
    line: string,
    callback: (err: any, result: [string[], string]) => void
  ): void {
    const words = line.trimStart().split(/\s+/);
    const lastWord = words[words.length - 1] ?? '';

    // /skill pin <name> or /skill mute <name> → complete skill names
    const skillArgMatch = line.match(/^\/(skill)\s+(pin|mute)\s+(\S*)$/);
    if (skillArgMatch) {
      const partial = skillArgMatch[3];
      const prefix = line.slice(0, line.length - partial.length);
      const hits = skillNames.filter((n) => n.startsWith(partial)).map((n) => prefix + n);
      return callback(null, [hits.length ? hits : [], line]);
    }

    // /skill with no subcommand → suggest subcommands
    if (/^\/skill\s*$/.test(line)) {
      return callback(null, [
        ['/skill list', '/skill pin ', '/skill mute ', '/skill reset'],
        line,
      ]);
    }

    // General slash command completions (no space yet)
    if (line.startsWith('/') && words.length === 1) {
      const cmds = [
        '/skill', '/debug', '/plan ', '/plans', '/memory',
        '/cost', '/skills', '/undo', '/sessions',
        '/session resume ', '/session list', '/analyze', '/anyalize',
      ];
      const hits = cmds.filter((c) => c.startsWith(line));
      return callback(null, [hits, line]);
    }

    // File path autocomplete: last token looks like a path
    if (lastWord.includes('/') || lastWord.startsWith('./') || lastWord.startsWith('src')) {
      try {
        const dir = path.dirname(lastWord) || '.';
        const base = path.basename(lastWord);
        const absDir = path.join(process.cwd(), dir);
        const entries = fsSync.readdirSync(absDir, { withFileTypes: true });
        const hits = entries
          .filter((e) => e.name.startsWith(base) && !isIgnored(path.join(dir, e.name)))
          .map((e) => {
            const rel = path.join(dir, e.name).replace(/\\/g, '/');
            const suffix = e.isDirectory() ? '/' : '';
            return words.slice(0, -1).concat([rel + suffix]).join(' ');
          });
        return callback(null, [hits, line]);
      } catch {
        return callback(null, [[], line]);
      }
    }

    callback(null, [[], line]);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  });

  const spinner = new CliSpinner();

  let sessionId = String(Date.now());
  let sessionCost = 0;
  const sessionManager = new SessionManager();

  let config = loadAppConfig();

  // If no credentials found in env or config, prompt for onboarding setup
  const hasLocalOpenAi = config.openaiEndpoint?.includes('localhost') || config.openaiEndpoint?.includes('127.0.0.1');
  if (!config.anthropicApiKey && !config.openaiApiKey && !hasLocalOpenAi) {
    config = await runOnboarding(rl);
  }

  // Validate credentials based on the active provider for the "smart" alias
  const activeSmartConfig = config.modelAliases.smart;
  if (activeSmartConfig.provider === 'anthropic' && !config.anthropicApiKey) {
    console.error(
      'Error: ANTHROPIC_API_KEY is not set but is required by the active "smart" model provider.'
    );
    console.error(
      'Please set it using: $env:ANTHROPIC_API_KEY="your-key" in PowerShell or set ANTHROPIC_API_KEY="your-key" in Command Prompt'
    );
    process.exit(1);
  } else if (
    activeSmartConfig.provider === 'openai-compat' &&
    !config.openaiApiKey &&
    !config.openaiEndpoint?.includes('localhost') &&
    !config.openaiEndpoint?.includes('127.0.0.1')
  ) {
    console.error(
      'Error: OPENAI_API_KEY is not set but is required by the active "smart" OpenAI provider.'
    );
    console.error(
      'Please set it using: $env:OPENAI_API_KEY="your-key" in PowerShell or set OPENAI_API_KEY="your-key" in Command Prompt'
    );
    process.exit(1);
  }

  const registry = new ToolRegistry();
  const safetyGate = new SafetyGate();
  const backupManager = new BackupManager();
  const projectMemory = new ProjectMemoryManager(config);
  const planningManager = new PlanningManager(config);
  const skillLoader = new SkillLoader();

  // Preload skill names asynchronously for tab completion
  skillLoader.loadSkills().then((skills) => {
    skillNames = skills.map((s) => s.name);
  }).catch(() => {});

  const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
  };

  const COLLAPSE_THRESHOLD = 15; // lines before folding tool output

  /**
   * Estimates cost based on public pricing models, incorporating prompt caching details.
   */
  const estimateCost = (modelId: string, inputTokens: number, outputTokens: number, cacheHit?: boolean): number => {
    const modelLower = modelId.toLowerCase();
    let cost = 0;

    if (modelLower.includes('sonnet')) {
      const inputCostRate = cacheHit ? 0.3 : 3.0;
      cost = (inputTokens * inputCostRate + outputTokens * 15.0) / 1_000_000;
    } else if (modelLower.includes('haiku')) {
      const inputCostRate = cacheHit ? 0.08 : 0.8;
      cost = (inputTokens * inputCostRate + outputTokens * 4.0) / 1_000_000;
    } else if (modelLower.includes('deepseek-chat') || modelLower.includes('deepseek-v3') || (modelLower.includes('deepseek') && !modelLower.includes('reasoner') && !modelLower.includes('coder') && !modelLower.includes('r1'))) {
      const inputCostRate = cacheHit ? 0.055 : 0.14;
      cost = (inputTokens * inputCostRate + outputTokens * 0.28) / 1_000_000;
    } else if (modelLower.includes('deepseek-coder') || modelLower.includes('deepseek-reasoner') || modelLower.includes('deepseek-r1') || modelLower.includes('r1')) {
      const inputCostRate = cacheHit ? 0.14 : 0.55;
      cost = (inputTokens * inputCostRate + outputTokens * 2.19) / 1_000_000;
    } else if (modelLower.includes('gpt-4o-mini')) {
      cost = (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;
    } else if (modelLower.includes('gpt-4o')) {
      cost = (inputTokens * 5.0 + outputTokens * 15.0) / 1_000_000;
    } else {
      const inputCostRate = cacheHit ? 0.2 : 2.0;
      cost = (inputTokens * inputCostRate + outputTokens * 10.0) / 1_000_000;
    }

    return Number(cost.toFixed(6));
  };

  /**
   * Prompts the developer for manual confirmation on dangerous actions.
   */
  const onConfirmDangerousTool = (toolCall: ToolCall, reason: string): Promise<boolean> => {
    if (spinner.active()) {
      spinner.stop();
    }
    return new Promise((resolve) => {
      console.log(`\n${colors.bold}${colors.yellow}⚠️  [SAFETY WARNING] A dangerous action has been requested:${colors.reset}`);
      console.log(`${colors.bold}Reason:${colors.reset} ${reason}`);
      console.log(`${colors.bold}Tool:${colors.reset}   ${toolCall.name}`);
      console.log(`${colors.bold}Input:${colors.reset}  ${JSON.stringify(toolCall.input, null, 2)}`);

      rl.question('\nDo you want to allow this action? (y/N): ', (answer) => {
        const approved = answer.trim().toLowerCase() === 'y';
        if (approved) {
          console.log(`${colors.bold}${colors.green}✅ Action approved.${colors.reset}\n`);
          resolve(true);
        } else {
          console.log(`${colors.bold}${colors.red}❌ Action rejected.${colors.reset}\n`);
          resolve(false);
        }
      });
    });
  };

  const orchestrator = new AgentOrchestrator({
    config,
    registry,
    safetyGate,
    backupManager,
    onConfirmDangerousTool,
    pinnedSkills,
    mutedSkills,
  });

  let conversationHistory: ConversationMessage[] = [];

  /**
   * Summarizes the session conversation, saves it as an artifact, and updates memory.md.
   */
  const saveSessionMemoryAndExit = async () => {
    if (spinner.active()) {
      spinner.stop();
    }
    if (conversationHistory.length > 0) {
      console.log('\n💾 Summarizing session and updating project memory...');
      try {
        const summary = await projectMemory.createSessionSummary(conversationHistory);
        await projectMemory.saveSessionSummary(summary);
        await projectMemory.appendMemory(summary);
        await sessionManager.updateSessionSummary(sessionId, summary);
        await sessionManager.saveSessionHistory(sessionId, conversationHistory);
        console.log(
          '✅ Session summary saved to .agent/sessions/ and appended to .agent/memory.md.'
        );
      } catch (err: any) {
        console.error('⚠️  Failed to save project memory:', err.message || err);
      }
    }
    BashTool.cleanup();
    console.log('Goodbye!');
    process.exit(0);
  };

  /**
   * Prints the global token statistics and costs from ~/.agent/usage.log.
   */
  const printCostSummary = async () => {
    const logPath = path.join(os.homedir(), '.agent', 'usage.log');
    try {
      const data = await fs.readFile(logPath, 'utf-8');
      const lines = data.trim().split('\n');
      let totalInput = 0;
      let totalOutput = 0;
      let totalCost = 0;
      let count = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          totalInput += parsed.inputTokens || 0;
          totalOutput += parsed.outputTokens || 0;
          totalCost += parsed.estimatedCostUsd || 0;
          count++;
        } catch {
          // Ignore parse errors
        }
      }

      console.log('\n📊 Global Usage & Cost Stats:');
      console.log(`  Total API Sessions:   ${count}`);
      console.log(`  Total Input Tokens:   ${totalInput.toLocaleString()}`);
      console.log(`  Total Output Tokens:  ${totalOutput.toLocaleString()}`);
      console.log(`  Total Estimated Cost: $${totalCost.toFixed(6)} USD`);
    } catch {
      console.log('\n📊 Global Usage Stats: No usage logs found.');
    }
  };

  // Capture SIGINT (Ctrl+C) to auto-summarize
  rl.on('SIGINT', async () => {
    await saveSessionMemoryAndExit();
  });

  const promptUser = () => {
    rl.question('\n👤 You > ', async (input) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        promptUser();
        return;
      }

      // ── exit / quit ──────────────────────────────────────────────────────
      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        rl.close();
        await saveSessionMemoryAndExit();
        return;
      }

      // ── e / expand: show last collapsed tool output ──────────────────────
      if (
        (trimmedInput.toLowerCase() === 'e' || trimmedInput.toLowerCase() === 'expand') &&
        lastCollapsedOutput !== null
      ) {
        console.log(`\n${colors.dim}━━━ Full Output ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(lastCollapsedOutput);
        console.log(`${colors.dim}━━━ End Output ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        lastCollapsedOutput = null;
        promptUser();
        return;
      }

      // ── /undo ────────────────────────────────────────────────────────────
      if (trimmedInput.toLowerCase() === '/undo') {
        const success = await backupManager.undoLast();
        if (success) {
          console.log('✅ Successfully rolled back the last file modification.');
        } else {
          console.log('⚠️  No modifications found in the session backup history to undo.');
        }
        promptUser();
        return;
      }

      // ── /cost ────────────────────────────────────────────────────────────
      if (trimmedInput.toLowerCase() === '/cost') {
        await printCostSummary();
        promptUser();
        return;
      }

      // ── /skills (list available skills) ─────────────────────────────────
      if (trimmedInput.toLowerCase() === '/skills') {
        try {
          const skills = await skillLoader.loadSkills();
          skillNames = skills.map((s) => s.name); // keep completer in sync
          console.log('\n💡 Available Skills:');
          if (skills.length === 0) {
            console.log('  (none)');
          } else {
            skills.forEach((s) => {
              const pinned = pinnedSkills.has(s.name) ? ` ${colors.green}[PINNED]${colors.reset}` : '';
              const muted = mutedSkills.has(s.name) ? ` ${colors.red}[MUTED]${colors.reset}` : '';
              console.log(`  - ${colors.bold}${s.name}${colors.reset}${pinned}${muted}`);
              console.log(`    ${colors.dim}${s.description}${colors.reset}`);
            });
          }
        } catch (err: any) {
          console.error('Error loading skills:', err.message || err);
        }
        promptUser();
        return;
      }

      // ── /skill pin|mute|list|reset ───────────────────────────────────────
      if (trimmedInput.toLowerCase().startsWith('/skill')) {
        const parts = trimmedInput.split(/\s+/);
        const sub = parts[1]?.toLowerCase();
        const name = parts[2]?.toLowerCase();

        if (sub === 'list' || !sub) {
          console.log('\n💡 Skill Status:');
          if (skillNames.length === 0) {
            console.log('  (no skills loaded — run /skills first)');
          } else {
            for (const n of skillNames) {
              const pinTag = pinnedSkills.has(n) ? ` ${colors.green}[PINNED — always active]${colors.reset}` : '';
              const muteTag = mutedSkills.has(n) ? ` ${colors.red}[MUTED — always excluded]${colors.reset}` : '';
              const status = !pinTag && !muteTag ? ` ${colors.dim}[auto]${colors.reset}` : '';
              console.log(`  - ${n}${pinTag}${muteTag}${status}`);
            }
          }
          console.log(`\n  ${colors.dim}Use: /skill pin <name>  /skill mute <name>  /skill reset${colors.reset}`);
        } else if (sub === 'pin' && name) {
          pinnedSkills.add(name);
          mutedSkills.delete(name);
          console.log(`${colors.green}📌 "${name}" pinned — injected on every request this session.${colors.reset}`);
        } else if (sub === 'mute' && name) {
          mutedSkills.add(name);
          pinnedSkills.delete(name);
          console.log(`${colors.yellow}🔇 "${name}" muted — excluded even if auto-matched.${colors.reset}`);
        } else if (sub === 'reset') {
          pinnedSkills.clear();
          mutedSkills.clear();
          console.log(`${colors.green}✅ All skill pins and mutes cleared. Back to automatic matching.${colors.reset}`);
        } else {
          console.log('Usage: /skill list | /skill pin <name> | /skill mute <name> | /skill reset');
        }
        promptUser();
        return;
      }

      // ── /debug on|off ────────────────────────────────────────────────────
      if (trimmedInput.toLowerCase().startsWith('/debug')) {
        const arg = trimmedInput.split(/\s+/)[1]?.toLowerCase();
        if (arg === 'on') {
          debugMode = true;
          console.log(`${colors.green}🔍 Flow logs ON — internal steps will be shown dim below each request.${colors.reset}`);
        } else if (arg === 'off') {
          debugMode = false;
          console.log(`${colors.yellow}🔍 Flow logs OFF.${colors.reset}`);
        } else {
          console.log(`Flow logs: ${debugMode ? `${colors.green}ON${colors.reset}` : `${colors.yellow}OFF${colors.reset}`}. Use /debug on|off`);
        }
        promptUser();
        return;
      }

      // ── /memory ──────────────────────────────────────────────────────────
      if (trimmedInput.toLowerCase() === '/memory') {
        try {
          const memory = await projectMemory.loadMemory();
          console.log('\n📖 Project Timeline Memory (.agent/memory.md):');
          if (!memory.trim()) {
            console.log('  (empty memory file)');
          } else {
            console.log(memory.trim());
          }
        } catch (err: any) {
          console.error('Error loading memory:', err.message || err);
        }
        promptUser();
        return;
      }

      // ── /plan ────────────────────────────────────────────────────────────
      if (trimmedInput.startsWith('/plan ')) {
        const goal = trimmedInput.substring(6).trim();
        if (!goal) {
          console.log('Error: Please specify a goal, e.g. /plan implement feature X');
          promptUser();
          return;
        }

        console.log('📝 Drafting plan outline with fast model...');
        try {
          const draft = await planningManager.draftPlan(goal);
          console.log('🔍 Critiquing and rewriting plan with smart model...');
          const finalPlan = await planningManager.critiqueAndRewrite(draft);

          console.log('\n================ PROPOSED PLAN ================');
          console.log(finalPlan);
          console.log('===============================================\n');

          rl.question('\nDo you approve this plan? (y/N): ', async (answer) => {
            const approved = answer.trim().toLowerCase() === 'y';
            if (approved) {
              const planId = `plan_${Date.now()}`;
              await planningManager.savePlan(planId, finalPlan);
              console.log(`✅ Plan approved and saved as active: .agent/plans/${planId}.md`);
            } else {
              console.log('❌ Plan rejected.');
            }
            promptUser();
          });
        } catch (err: any) {
          console.error('❌ Error generating plan:', err.message || err);
          promptUser();
        }
        return;
      }

      // ── /plans ───────────────────────────────────────────────────────────
      if (trimmedInput.toLowerCase() === '/plans') {
        try {
          const list = await planningManager.listPlans();
          console.log('\n📁 Active Plans:');
          if (list.active.length === 0) console.log('  (none)');
          else list.active.forEach((p) => console.log(`  - ${p}`));

          console.log('\n📁 Archived Plans:');
          if (list.archived.length === 0) console.log('  (none)');
          else list.archived.forEach((p) => console.log(`  - ${p}`));
        } catch (err: any) {
          console.error('Error listing plans:', err.message || err);
        }
        promptUser();
        return;
      }

      // ── /plans archive ───────────────────────────────────────────────────
      if (trimmedInput.startsWith('/plans archive ')) {
        const id = trimmedInput.substring(15).trim();
        if (!id) {
          console.log('Error: Please specify a plan ID, e.g. /plans archive plan_1718919600');
          promptUser();
          return;
        }

        try {
          const success = await planningManager.archivePlan(id);
          if (success) {
            console.log(`✅ Plan "${id}" successfully archived.`);
          } else {
            console.log(`⚠️  Could not find active plan "${id}" to archive.`);
          }
        } catch (err: any) {
          console.error('Error archiving plan:', err.message || err);
        }
        promptUser();
        return;
      }

      // ── /session list or /sessions ───────────────────────────────────────
      if (trimmedInput.toLowerCase() === '/session list' || trimmedInput.toLowerCase() === '/sessions') {
        try {
          const data = await sessionManager.loadSessionData();
          console.log('\n📊 Project Global Session Stats:');
          console.log(`  Total Project Input Tokens:   ${data.projectStats.totalInputTokens.toLocaleString()}`);
          console.log(`  Total Project Output Tokens:  ${data.projectStats.totalOutputTokens.toLocaleString()}`);
          console.log(`  Total Project Estimated Cost: $${data.projectStats.totalCostUsd.toFixed(6)} USD`);

          console.log('\n📁 Saved Resumable Chat Sessions:');
          if (data.sessions.length === 0) {
            console.log('  (none)');
          } else {
            for (const s of data.sessions) {
              const activeLabel = s.id === sessionId ? ` [${colors.green}ACTIVE${colors.reset}]` : '';
              console.log(`  - Session ID: ${colors.bold}${s.id}${colors.reset}${activeLabel}`);
              console.log(`    Created At: ${s.createdAt}`);
              console.log(`    Total Cost: $${s.costUsd.toFixed(6)} USD (${s.inputTokens} in, ${s.outputTokens} out)`);
              console.log(`    Summary:    ${colors.dim}${s.summary}${colors.reset}`);
              console.log('  ------------------------------------------');
            }
          }
        } catch (err: any) {
          console.error('Error loading sessions catalog:', err.message || err);
        }
        promptUser();
        return;
      }

      // ── /session resume ──────────────────────────────────────────────────
      if (trimmedInput.startsWith('/session resume ') || trimmedInput.startsWith('/session load ')) {
        const parts = trimmedInput.split(' ');
        const targetId = parts[parts.length - 1].trim();
        if (!targetId) {
          console.log('Error: Please specify a Session ID, e.g. /session resume 1782036344784');
          promptUser();
          return;
        }

        try {
          const data = await sessionManager.loadSessionData();
          const targetSession = data.sessions.find((s) => s.id === targetId);
          if (!targetSession) {
            console.log(`Error: Could not find session with ID "${targetId}" in project history.`);
            promptUser();
            return;
          }

          if (spinner.active()) {
            spinner.stop();
          }

          conversationHistory = await sessionManager.loadSessionHistory(targetId);
          sessionId = targetId;
          sessionCost = targetSession.costUsd;
          orchestrator.resetSessionState();

          console.log(`${colors.green}✅ Session "${targetId}" successfully resumed.${colors.reset}`);
          console.log(`   Restored ${conversationHistory.length} messages. Cumulative cost: $${sessionCost.toFixed(6)} USD.`);
        } catch (err: any) {
          console.error(`Error loading session history for "${targetId}":`, err.message || err);
        }
        promptUser();
        return;
      }

      // ── Main conversation turn ────────────────────────────────────────────
      let userQuery = trimmedInput;
      if (trimmedInput.toLowerCase().startsWith('/analyze') || trimmedInput.toLowerCase().startsWith('/anyalize')) {
        console.log('🔍 Initiating codebase analysis...');
        userQuery = `${trimmedInput} - Analyze this codebase and produce project-overview.md, folder-structure.md, and code-conventions.md inside a top-level agent/ folder.`;
      }

      conversationHistory.push({
        role: 'user',
        content: userQuery,
      });

      try {
        conversationHistory = await orchestrator.runTurn(
          conversationHistory,
          (progress) => {
            if (progress.type === 'request_start') {
              spinner.start('🤖 AI is thinking...');
            } else if (progress.type === 'request_end') {
              if (spinner.active()) {
                spinner.stop();
              }
            } else if (progress.type === 'flow_event') {
              // Dim single-line trace — always on unless /debug off
              if (debugMode) {
                if (spinner.active()) spinner.stop();
                const dur = progress.durationMs != null
                  ? ` ${colors.dim}(${progress.durationMs}ms)${colors.reset}`
                  : '';
                const label = (progress.label ?? '').padEnd(14);
                console.log(
                  `  ${colors.gray}›${colors.reset} ${colors.dim}${label}${colors.reset} ` +
                  `${colors.gray}${progress.detail ?? ''}${colors.reset}${dur}`
                );
              }
            } else if (progress.type === 'tool_start' && progress.toolCall) {
              if (spinner.active()) {
                spinner.stop();
              }
              console.log(
                `${colors.dim}⚙️  [Tool] ${colors.bold}${progress.toolCall.name}${colors.reset}`,
                progress.toolCall.input
              );
              spinner.start(`⚙️  Running: ${progress.toolCall.name}...`);
            } else if (progress.type === 'tool_end' && progress.toolCall) {
              if (spinner.active()) {
                spinner.stop();
              }
              const result = progress.result ?? '';
              const lines = result.split('\n');
              if (lines.length > COLLAPSE_THRESHOLD) {
                // Fold large output — user can type e/expand to see full content
                lastCollapsedOutput = result;
                console.log(
                  `${colors.dim}✔️  [${progress.toolCall.name}] ` +
                  `${lines.length} lines returned  ` +
                  `${colors.yellow}(type "e" to expand)${colors.reset}`
                );
              } else {
                lastCollapsedOutput = null;
                const snippet = result.length > 300 ? result.substring(0, 300) + '...' : result;
                console.log(
                  `${colors.dim}✔️  [${progress.toolCall.name}] →\n${snippet}${colors.reset}`
                );
              }
            } else if (progress.type === 'thinking' && progress.content) {
              if (spinner.active()) spinner.stop();
              console.log(`\n🧠 ${colors.bold}${colors.magenta}Thinking:${colors.reset}`);
              console.log(`${colors.gray}${colors.dim}┌──────────────────────────────────────────────────`);
              const thinkLines = progress.content.trim().split('\n');
              for (const line of thinkLines) {
                console.log(`${colors.gray}${colors.dim}│${colors.reset} ${colors.gray}${colors.italic}${line}${colors.reset}`);
              }
              console.log(`${colors.gray}${colors.dim}└──────────────────────────────────────────────────${colors.reset}\n`);
            } else if (progress.type === 'stats' && progress.stats) {
              if (spinner.active()) spinner.stop();
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
              sessionCost += estimatedCost;
              sessionManager.updateStats(sessionId, stats.inputTokens, stats.outputTokens, estimatedCost).catch(() => {});

              const toolLatencyNote = toolSec ? ` | Tool Time: ${toolSec}s` : '';
              const budgetNote = stats.declaredBudget ? ` | Budget: ~${stats.declaredBudget} (used ${stats.outputTokens})` : '';
              const cleanStatsMsg = `API stats: Model: ${stats.modelId} | Model Latency: ${modelSec}s${toolLatencyNote}${budgetNote} | Speed: ${speed} t/s | Input: ${stats.inputTokens} | Output: ${stats.outputTokens} | Cache Hit: ${cacheStatusRaw} | Cost: $${estimatedCost.toFixed(6)} USD`;
              SessionLogger.getInstance().logSystem(cleanStatsMsg);

              const toolLatencyDisplay = toolSec ? ` | Tool: ${colors.yellow}${toolSec}s${colors.reset}` : '';
              const budgetDisplay = stats.declaredBudget ? ` | Budget: ~${colors.bold}${stats.declaredBudget}${colors.reset} (used ${colors.bold}${stats.outputTokens}${colors.reset})` : '';
              console.log(
                `\n📊 ${colors.bold}Metrics: ${colors.reset}` +
                `[${colors.cyan}${stats.modelId}${colors.reset}] | ` +
                `Model: ${colors.yellow}${modelSec}s${colors.reset}${toolLatencyDisplay}${budgetDisplay} | ` +
                `Speed: ${colors.yellow}${speed} t/s${colors.reset} | ` +
                `Tokens: ${colors.bold}${stats.inputTokens}${colors.reset} in, ${colors.bold}${stats.outputTokens}${colors.reset} out | ` +
                `Cache: ${cacheStatus} | ` +
                `Cost: ${colors.green}$${estimatedCost.toFixed(6)} USD${colors.reset} | ` +
                `Session: ${colors.green}$${sessionCost.toFixed(6)} USD${colors.reset}\n`
              );
            } else if (progress.type === 'text' && progress.content) {
              if (spinner.active()) spinner.stop();
              console.log(`${colors.bold}${colors.green}🤖 Agent > ${colors.reset}${progress.content}`);
            }
          }
        );
      } catch (err: any) {
        if (spinner.active()) {
          spinner.stop();
        }
        console.error('\n❌ Error during execution:', err.message || err);
      }

      if (spinner.active()) {
        spinner.stop();
      }
      promptUser();
    });
  };

  promptUser();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
