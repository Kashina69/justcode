#!/usr/bin/env node
import readline from 'readline';
import fs from 'fs/promises';
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
    // Allow local endpoints (e.g. Ollama, localhost) to run without keys
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

  /**
   * Estimates cost based on public pricing models, incorporating prompt caching details.
   */
  const estimateCost = (modelId: string, inputTokens: number, outputTokens: number, cacheHit?: boolean): number => {
    const modelLower = modelId.toLowerCase();
    let cost = 0;

    if (modelLower.includes('sonnet')) {
      const inputCostRate = cacheHit ? 0.3 : 3.0; // Cache read vs normal input ($3/M vs $0.3/M)
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
   * 
   * @param toolCall The requested tool execution details.
   * @param reason The reason why the action is classified as dangerous.
   * @returns A promise resolving to true if confirmed, false otherwise.
   */
  const onConfirmDangerousTool = (toolCall: ToolCall, reason: string): Promise<boolean> => {
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
  });

  let conversationHistory: ConversationMessage[] = [];

  /**
   * Summarizes the session conversation, saves it as an artifact, and updates memory.md.
   */
  const saveSessionMemoryAndExit = async () => {
    if (conversationHistory.length > 0) {
      console.log('\n💾 Summarizing session and updating project memory...');
      try {
        const summary = await projectMemory.createSessionSummary(conversationHistory);
        await projectMemory.saveSessionSummary(summary);
        await projectMemory.appendMemory(summary);
        console.log(
          '✅ Session summary saved to .agent/sessions/ and appended to .agent/memory.md.'
        );
      } catch (err: any) {
        console.error('⚠️  Failed to save project memory:', err.message || err);
      }
    }
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

      if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
        rl.close();
        await saveSessionMemoryAndExit();
        return;
      }

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

      // Handle /cost command
      if (trimmedInput.toLowerCase() === '/cost') {
        await printCostSummary();
        promptUser();
        return;
      }

      // Handle /skills command
      if (trimmedInput.toLowerCase() === '/skills') {
        try {
          const skills = await skillLoader.loadSkills();
          console.log('\n💡 Loaded Skills:');
          if (skills.length === 0) {
            console.log('  (none)');
          } else {
            skills.forEach((s) => {
              console.log(`  - Name: "${s.name}"`);
              console.log(`    Description: ${s.description}`);
            });
          }
        } catch (err: any) {
          console.error('Error loading skills:', err.message || err);
        }
        promptUser();
        return;
      }

      // Handle /memory command
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

      // Handle /plan command
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

      // Handle /plans command
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

      // Handle /plans archive command
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

      conversationHistory.push({
        role: 'user',
        content: trimmedInput,
      });

      try {
        conversationHistory = await orchestrator.runTurn(
          conversationHistory,
          (progress) => {
            if (progress.type === 'thinking' && progress.content) {
              console.log(`\n🧠 ${colors.bold}${colors.magenta}Thinking Process:${colors.reset}`);
              console.log(`${colors.gray}${colors.dim}┌────────────────────────────────────────────────────────`);
              const lines = progress.content.trim().split('\n');
              for (const line of lines) {
                console.log(`${colors.gray}${colors.dim}│${colors.reset} ${colors.gray}${colors.italic}${line}${colors.reset}`);
              }
              console.log(`${colors.gray}${colors.dim}└────────────────────────────────────────────────────────${colors.reset}\n`);
            } else if (progress.type === 'stats' && progress.stats) {
              const stats = progress.stats;
              const durationSec = stats.durationMs ? (stats.durationMs / 1000).toFixed(2) : '0.00';
              const speed = stats.durationMs && stats.outputTokens > 0
                ? (stats.outputTokens / (stats.durationMs / 1000)).toFixed(1)
                : 'N/A';
              const cacheStatus = stats.cacheHit ? `${colors.green}HIT${colors.reset}` : `${colors.yellow}MISS${colors.reset}`;
              const cacheStatusRaw = stats.cacheHit ? 'HIT' : 'MISS';
              const estimatedCost = estimateCost(stats.modelId, stats.inputTokens, stats.outputTokens, stats.cacheHit);

              // Log clean version to session logger
              const cleanStatsMsg = `API stats: Model: ${stats.modelId} | Latency: ${durationSec}s | Speed: ${speed} t/s | Input: ${stats.inputTokens} | Output: ${stats.outputTokens} | Cache Hit: ${cacheStatusRaw} | Cost: $${estimatedCost.toFixed(6)} USD`;
              SessionLogger.getInstance().logSystem(cleanStatsMsg);

              // Display styled version in terminal
              console.log(
                `\n📊 ${colors.bold}Metrics: ${colors.reset}` +
                `[${colors.cyan}${stats.modelId}${colors.reset}] | ` +
                `Latency: ${colors.yellow}${durationSec}s${colors.reset} | ` +
                `Speed: ${colors.yellow}${speed} t/s${colors.reset} | ` +
                `Tokens: ${colors.bold}${stats.inputTokens}${colors.reset} in, ${colors.bold}${stats.outputTokens}${colors.reset} out | ` +
                `Cache: ${cacheStatus} | ` +
                `Cost: ${colors.green}$${estimatedCost.toFixed(6)} USD${colors.reset}\n`
              );
            } else if (progress.type === 'text' && progress.content) {
              console.log(`${colors.bold}${colors.green}🤖 Agent > ${colors.reset}${progress.content}`);
            } else if (progress.type === 'tool_start' && progress.toolCall) {
              console.log(
                `${colors.dim}⚙️  [Tool Call] Executing "${progress.toolCall.name}" with input:${colors.reset}`,
                progress.toolCall.input
              );
            } else if (progress.type === 'tool_end' && progress.toolCall) {
              const snippet = progress.result
                ? progress.result.length > 200
                  ? progress.result.substring(0, 200) + '...'
                  : progress.result
                : '';
              console.log(
                `${colors.dim}✔️  [Tool Call Done] "${progress.toolCall.name}" returned:\n---[OUTPUT START]---\n${snippet}\n---[OUTPUT END]---${colors.reset}`
              );
            }
          }
        );
      } catch (err: any) {
        console.error('\n❌ Error during execution:', err.message || err);
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
