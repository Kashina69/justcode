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

function selectOption(question: string, options: string[]): Promise<number> {
  return new Promise((resolve) => {
    let selectedIndex = 0;

    // Hide cursor
    process.stdout.write('\x1b[?25l');

    function render() {
      process.stdout.write('\r\x1b[K' + question + '\n');
      for (let i = 0; i < options.length; i++) {
        const isSelected = i === selectedIndex;
        const cursor = isSelected ? '❯ ' : '  ';
        const color = isSelected ? '\x1b[36m\x1b[1m' : '\x1b[2m';
        process.stdout.write('\r\x1b[K' + `  ${cursor}${color}${options[i]}\x1b[0m\n`);
      }
      process.stdout.write(`\x1b[${options.length + 1}A`);
    }

    render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    function onKeypress(str: string, key: any) {
      if (key) {
        if (key.name === 'up') {
          selectedIndex = (selectedIndex - 1 + options.length) % options.length;
          render();
        } else if (key.name === 'down') {
          selectedIndex = (selectedIndex + 1) % options.length;
          render();
        } else if (key.name === 'return' || key.name === 'enter') {
          cleanup();
          process.stdout.write(`\x1b[${options.length + 1}B\n`);
          resolve(selectedIndex);
        } else if (key.ctrl && key.name === 'c') {
          cleanup();
          process.stdout.write('\x1b[?25h');
          process.exit(0);
        }
      }
    }

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdout.write('\x1b[?25h');
    }

    process.stdin.on('keypress', onKeypress);
  });
}

async function runOnboarding(rl: readline.Interface): Promise<AppConfig> {
  console.log('\n======================================================');
  console.log('🤖 Welcome to justcode! Let\'s set up your API keys.');
  console.log(`Your configuration will be saved to: ${getGlobalConfigPath()}`);
  console.log('======================================================\n');

  const providerOptions = [
    'Anthropic',
    'OpenAI',
    'DeepSeek',
    'OpenRouter',
    'Google Gemini',
    'Custom Provider'
  ];

  const choiceIndex = await selectOption('Select API Provider:', providerOptions);
  const selectedProvider = providerOptions[choiceIndex];

  let providerName = '';
  let providerType: 'anthropic' | 'openai-compat' = 'openai-compat';
  let endpoint = '';
  let apiKey = '';

  if (selectedProvider === 'Custom Provider') {
    providerName = await askQuestion(rl, 'Enter Provider Name (e.g. together, local): ');
    providerName = providerName.toLowerCase().trim();
    
    const typeChoice = await selectOption('Select Provider Type:', ['OpenAI-compatible', 'Anthropic']);
    providerType = typeChoice === 0 ? 'openai-compat' : 'anthropic';
    
    apiKey = await askQuestion(rl, 'Enter your API Key: ');
    endpoint = await askQuestion(rl, 'Enter the API Endpoint URL (e.g. http://localhost:11434/v1): ');
  } else {
    apiKey = await askQuestion(rl, `Enter your ${selectedProvider} API Key: `);
    
    if (selectedProvider === 'Anthropic') {
      providerName = 'anthropic';
      providerType = 'anthropic';
      endpoint = 'https://api.anthropic.com';
    } else if (selectedProvider === 'OpenAI') {
      providerName = 'openai';
      providerType = 'openai-compat';
      endpoint = 'https://api.openai.com/v1';
    } else if (selectedProvider === 'DeepSeek') {
      providerName = 'deepseek';
      providerType = 'openai-compat';
      endpoint = 'https://api.deepseek.com';
    } else if (selectedProvider === 'OpenRouter') {
      providerName = 'openrouter';
      providerType = 'openai-compat';
      endpoint = 'https://openrouter.ai/api/v1';
    } else if (selectedProvider === 'Google Gemini') {
      providerName = 'google-gemini';
      providerType = 'openai-compat';
      endpoint = 'https://generativelabs.google';
    }
  }

  let modelAliases = {
    fast: { provider: providerName, modelId: 'gpt-4o-mini' },
    smart: { provider: providerName, modelId: 'gpt-4o' },
    planner: { provider: providerName, modelId: 'gpt-4o' }
  };

  if (providerName === 'anthropic') {
    modelAliases = {
      fast: { provider: providerName, modelId: 'claude-3-5-haiku-20241022' },
      smart: { provider: providerName, modelId: 'claude-3-5-sonnet-20241022' },
      planner: { provider: providerName, modelId: 'claude-3-5-sonnet-20241022' }
    };
  } else if (providerName === 'deepseek') {
    modelAliases = {
      fast: { provider: providerName, modelId: 'deepseek-chat' },
      smart: { provider: providerName, modelId: 'deepseek-coder' },
      planner: { provider: providerName, modelId: 'deepseek-coder' }
    };
  } else if (providerName === 'openrouter') {
    modelAliases = {
      fast: { provider: providerName, modelId: 'google/gemini-flash-1.5' },
      smart: { provider: providerName, modelId: 'anthropic/claude-3.5-sonnet' },
      planner: { provider: providerName, modelId: 'anthropic/claude-3.5-sonnet' }
    };
  } else if (providerName === 'google-gemini') {
    modelAliases = {
      fast: { provider: providerName, modelId: 'gemini-1.5-flash' },
      smart: { provider: providerName, modelId: 'gemini-1.5-pro' },
      planner: { provider: providerName, modelId: 'gemini-1.5-pro' }
    };
  }

  const currentConfig = loadAppConfig();
  const updatedProviders = {
    ...(currentConfig.providers || {}),
    [providerName]: {
      type: providerType,
      apiKey,
      endpoint: endpoint || undefined
    }
  };

  const updateData: Partial<AppConfig> = {
    providers: updatedProviders,
    modelAliases
  };

  if (providerType === 'anthropic') {
    updateData.anthropicApiKey = apiKey;
    if (endpoint) updateData.anthropicEndpoint = endpoint;
  } else {
    updateData.openaiApiKey = apiKey;
    if (endpoint) updateData.openaiEndpoint = endpoint;
  }

  writeAppConfig(updateData);

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
  const providerName = activeSmartConfig.provider;

  let isValid = true;
  let errorMsg = '';

  if (config.providers && config.providers[providerName]) {
    const providerCfg = config.providers[providerName];
    if (!providerCfg.apiKey) {
      isValid = false;
      errorMsg = `Error: API key for provider "${providerName}" is not set in configuration.`;
    }
  } else {
    // Legacy / fallback validation
    if (providerName === 'anthropic') {
      if (!config.anthropicApiKey) {
        isValid = false;
        errorMsg = 'Error: ANTHROPIC_API_KEY is not set but is required by the active "smart" model provider.\n' +
          'Please set it using: $env:ANTHROPIC_API_KEY="your-key" in PowerShell or set ANTHROPIC_API_KEY="your-key" in Command Prompt';
      }
    } else if (providerName === 'openai-compat') {
      const isLocal = config.openaiEndpoint?.includes('localhost') || config.openaiEndpoint?.includes('127.0.0.1');
      if (!config.openaiApiKey && !isLocal) {
        isValid = false;
        errorMsg = 'Error: OPENAI_API_KEY is not set but is required by the active "smart" OpenAI provider.\n' +
          'Please set it using: $env:OPENAI_API_KEY="your-key" in PowerShell or set OPENAI_API_KEY="your-key" in Command Prompt';
      }
    } else {
      // If providerName is not recognized and not in providers, fallback will default to anthropic in getProviderForAlias
      if (!config.anthropicApiKey) {
        isValid = false;
        errorMsg = `Error: ANTHROPIC_API_KEY is not set but is required as a fallback for provider "${providerName}".`;
      }
    }
  }

  if (!isValid) {
    console.error(errorMsg);
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

  const getModelInfo = (modelId: string): string => {
    const lower = modelId.toLowerCase();
    if (lower.includes('sonnet')) return 'Claude 3.5 Sonnet (Smart & capable)';
    if (lower.includes('haiku')) return 'Claude 3.5 Haiku (Fast & cheap)';
    if (lower.includes('gpt-4o-mini')) return 'GPT-4o Mini (Fast & cheap)';
    if (lower.includes('gpt-4o')) return 'GPT-4o (Smart & capable)';
    if (lower.includes('deepseek-chat')) return 'DeepSeek Chat (Capable & inexpensive)';
    if (lower.includes('deepseek-coder')) return 'DeepSeek Coder (Code specialist)';
    if (lower.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash (Fast & cheap)';
    if (lower.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro (Smart & capable)';
    return 'General purpose model';
  };

  const fetchModelsForProvider = async (providerType: string, apiKey: string, endpoint?: string): Promise<{ id: string }[]> => {
    if (providerType === 'anthropic') {
      return [
        { id: 'claude-3-5-sonnet-20241022' },
        { id: 'claude-3-5-haiku-20241022' },
        { id: 'claude-3-opus-20240229' },
      ];
    }

    const cleanUrl = (endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const targetUrl = `${cleanUrl}/models`;

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetch(targetUrl, { headers });
      if (res.ok) {
        const json = (await res.json()) as any;
        if (json.data && Array.isArray(json.data)) {
          return json.data.map((m: any) => ({
            id: m.id,
          }));
        }
      }
    } catch {
      // Ignore
    }

    return [
      { id: 'gpt-4o' },
      { id: 'gpt-4o-mini' },
      { id: 'deepseek-chat' },
      { id: 'deepseek-coder' },
      { id: 'gemini-1.5-flash' },
      { id: 'gemini-1.5-pro' },
    ];
  };

  const resumeSessionById = async (targetId: string) => {
    try {
      const data = await sessionManager.loadSessionData();
      const targetSession = data.sessions.find((s) => s.id === targetId);
      if (!targetSession) {
        console.log(`Error: Could not find session with ID "${targetId}" in project history.`);
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
  };

  const handleSessionsMenu = async () => {
    try {
      const data = await sessionManager.loadSessionData();
      console.log('\n📊 Project Global Session Stats:');
      console.log(`  Total Project Input Tokens:   ${data.projectStats.totalInputTokens.toLocaleString()}`);
      console.log(`  Total Project Output Tokens:  ${data.projectStats.totalOutputTokens.toLocaleString()}`);
      console.log(`  Total Project Estimated Cost: $${data.projectStats.totalCostUsd.toFixed(6)} USD`);

      if (data.sessions.length === 0) {
        console.log('\n📁 No saved resumable chat sessions found.');
        promptUser();
        return;
      }

      const options = data.sessions.map((s) => {
        const activeLabel = s.id === sessionId ? ' [ACTIVE]' : '';
        const summarySnippet = s.summary.length > 50 ? s.summary.substring(0, 47) + '...' : s.summary;
        return `[ID: ${s.id}]${activeLabel} ${s.createdAt} | Cost: $${s.costUsd.toFixed(4)} | Summary: "${summarySnippet}"`;
      });
      options.push('[Cancel / Return]');

      const idx = await selectOption('\nSelect a session to resume or load:', options);
      if (idx === options.length - 1) {
        promptUser();
        return;
      }

      const selectedSession = data.sessions[idx];
      await resumeSessionById(selectedSession.id);
    } catch (err: any) {
      console.error('Error loading sessions menu:', err.message || err);
    }
    promptUser();
  };

  const handleModelsMenu = async () => {
    const aliasOptions = ['fast', 'smart', 'planner', '[Cancel]'];
    const aliasIndex = await selectOption('Select model alias to update:', aliasOptions);
    if (aliasIndex === 3) {
      return;
    }
    const selectedAlias = aliasOptions[aliasIndex] as 'fast' | 'smart' | 'planner';

    let cfg = loadAppConfig();
    const providersList = Object.keys(cfg.providers || {});

    if (!providersList.includes('anthropic')) providersList.push('anthropic');
    if (!providersList.includes('openai-compat')) providersList.push('openai-compat');

    providersList.push('[Cancel]');
    const providerIndex = await selectOption('Select provider for this alias:', providersList);
    if (providerIndex === providersList.length - 1) {
      return;
    }
    const selectedProvider = providersList[providerIndex];

    let providerType = selectedProvider === 'anthropic' ? 'anthropic' : 'openai-compat';
    let apiKey = selectedProvider === 'anthropic' ? cfg.anthropicApiKey || '' : cfg.openaiApiKey || '';
    let endpoint = selectedProvider === 'anthropic' ? cfg.anthropicEndpoint : cfg.openaiEndpoint;

    if (cfg.providers && cfg.providers[selectedProvider]) {
      providerType = cfg.providers[selectedProvider].type;
      apiKey = cfg.providers[selectedProvider].apiKey;
      endpoint = cfg.providers[selectedProvider].endpoint;
    }

    console.log(`\n⏳ Fetching available models for provider "${selectedProvider}"...`);
    const fetchedModels = await fetchModelsForProvider(providerType, apiKey, endpoint);

    const modelOptions = fetchedModels.map(m => `${m.id} — ${getModelInfo(m.id)}`);
    modelOptions.push('[Cancel]');

    const modelIndex = await selectOption('Select model from list:', modelOptions);
    if (modelIndex === modelOptions.length - 1) {
      return;
    }
    const selectedModel = fetchedModels[modelIndex].id;

    const currentAliases = { ...cfg.modelAliases };
    currentAliases[selectedAlias] = { provider: selectedProvider, modelId: selectedModel };

    writeAppConfig({ modelAliases: currentAliases });
    console.log(`\n✅ Alias "${selectedAlias}" successfully mapped to provider "${selectedProvider}" using model "${selectedModel}".\n`);
  };

  const handleConfigMenu = async () => {
    while (true) {
      const configMenuOptions = [
        'Add New API Provider',
        'Edit Existing API Provider',
        'Change Model Aliases (/models)',
        'View Config Summary',
        'Exit Config Editor'
      ];

      const choice = await selectOption('\nInteractive Config Editor:', configMenuOptions);
      if (choice === 4) {
        break;
      }

      let cfg = loadAppConfig();

      if (choice === 0) {
        const name = await askQuestion(rl, 'Enter new Provider Name (e.g. together): ');
        const trimmedName = name.toLowerCase().trim();
        if (!trimmedName) continue;

        const typeChoice = await selectOption('Select Provider Type:', ['OpenAI-compatible', 'Anthropic']);
        const type: 'openai-compat' | 'anthropic' = typeChoice === 0 ? 'openai-compat' : 'anthropic';

        const apiKey = await askQuestion(rl, 'Enter API Key: ');
        const endpoint = await askQuestion(rl, 'Enter Endpoint URL: ');

        const updatedProviders = {
          ...(cfg.providers || {}),
          [trimmedName]: {
            type,
            apiKey,
            endpoint: endpoint || undefined
          }
        };

        writeAppConfig({ providers: updatedProviders });
        console.log(`\n✅ Provider "${trimmedName}" successfully configured.\n`);

      } else if (choice === 1) {
        const providers = Object.keys(cfg.providers || {});
        if (providers.length === 0) {
          console.log('\n⚠️  No custom providers currently configured.');
          continue;
        }

        providers.push('[Cancel]');
        const idx = await selectOption('Select provider to edit:', providers);
        if (idx === providers.length - 1) continue;

        const providerToEdit = providers[idx];
        const providerConfig = cfg.providers![providerToEdit];

        console.log(`\nEditing Provider "${providerToEdit}" (press Enter to keep existing value):`);
        const newKey = await askQuestion(rl, `Enter new API Key (current: ${providerConfig.apiKey.substring(0, 8)}...): `);
        const newEndpoint = await askQuestion(rl, `Enter new Endpoint URL (current: ${providerConfig.endpoint || 'none'}): `);

        const updatedProviders = {
          ...(cfg.providers || {}),
          [providerToEdit]: {
            ...providerConfig,
            apiKey: newKey || providerConfig.apiKey,
            endpoint: newEndpoint || providerConfig.endpoint
          }
        };

        writeAppConfig({ providers: updatedProviders });
        console.log(`\n✅ Provider "${providerToEdit}" successfully updated.\n`);

      } else if (choice === 2) {
        await handleModelsMenu();
      } else if (choice === 3) {
        console.log('\n================ CONFIG SUMMARY ================');
        console.log('Model Aliases:');
        console.log(`  fast:    provider="${cfg.modelAliases.fast.provider}" modelId="${cfg.modelAliases.fast.modelId}"`);
        console.log(`  smart:   provider="${cfg.modelAliases.smart.provider}" modelId="${cfg.modelAliases.smart.modelId}"`);
        console.log(`  planner: provider="${cfg.modelAliases.planner.provider}" modelId="${cfg.modelAliases.planner.modelId}"`);
        
        const customProviders = Object.keys(cfg.providers || {});
        console.log('\nConfigured Providers:');
        if (customProviders.length === 0) {
          console.log('  (none)');
        } else {
          for (const name of customProviders) {
            const p = cfg.providers![name];
            console.log(`  - ${name}: type=${p.type} endpoint=${p.endpoint || 'default'} key=${p.apiKey.substring(0, 8)}...`);
          }
        }
        console.log('================================================\n');
      }
    }
    promptUser();
  };

  const handleCommand = async (trimmedInput: string): Promise<'sync' | 'async' | false> => {
    const lowerInput = trimmedInput.toLowerCase();

    if (lowerInput === 'exit' || lowerInput === 'quit') {
      rl.close();
      await saveSessionMemoryAndExit();
      return 'async';
    }

    if ((lowerInput === 'e' || lowerInput === 'expand') && lastCollapsedOutput !== null) {
      console.log(`\n${colors.dim}━━━ Full Output ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(lastCollapsedOutput);
      console.log(`${colors.dim}━━━ End Output ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      lastCollapsedOutput = null;
      return 'sync';
    }

    if (lowerInput === '/undo') {
      const success = await backupManager.undoLast();
      if (success) {
        console.log('✅ Successfully rolled back the last file modification.');
      } else {
        console.log('⚠️  No modifications found in the session backup history to undo.');
      }
      return 'sync';
    }

    if (lowerInput === '/cost') {
      await printCostSummary();
      return 'sync';
    }

    if (lowerInput === '/skills') {
      try {
        const skills = await skillLoader.loadSkills();
        skillNames = skills.map((s) => s.name);
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
      return 'sync';
    }

    if (lowerInput.startsWith('/skill')) {
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
      return 'sync';
    }

    if (lowerInput.startsWith('/debug')) {
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
      return 'sync';
    }

    if (lowerInput === '/memory') {
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
      return 'sync';
    }

    if (trimmedInput.startsWith('/plan ')) {
      const goal = trimmedInput.substring(6).trim();
      if (!goal) {
        console.log('Error: Please specify a goal, e.g. /plan implement feature X');
        return 'sync';
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
      return 'async';
    }

    if (lowerInput === '/plans') {
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
      return 'sync';
    }

    if (trimmedInput.startsWith('/plans archive ')) {
      const id = trimmedInput.substring(15).trim();
      if (!id) {
        console.log('Error: Please specify a plan ID, e.g. /plans archive plan_1718919600');
        return 'sync';
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
      return 'sync';
    }

    if (trimmedInput.startsWith('/session resume ') || trimmedInput.startsWith('/session load ')) {
      const parts = trimmedInput.split(' ');
      const targetId = parts[parts.length - 1].trim();
      if (!targetId) {
        console.log('Error: Please specify a Session ID, e.g. /session resume 1782036344784');
        return 'sync';
      }
      await resumeSessionById(targetId);
      return 'sync';
    }

    if (lowerInput === '/sessions' || lowerInput === '/session list') {
      await handleSessionsMenu();
      return 'async';
    }

    if (lowerInput === '/models') {
      await handleModelsMenu();
      promptUser();
      return 'async';
    }

    if (lowerInput === '/config') {
      await handleConfigMenu();
      return 'async';
    }

    return false;
  };

  const promptUser = () => {
    rl.question('\n👤 You > ', async (input) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        promptUser();
        return;
      }

      const commandResult = await handleCommand(trimmedInput);
      if (commandResult === 'sync') {
        promptUser();
        return;
      }
      if (commandResult === 'async') {
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
