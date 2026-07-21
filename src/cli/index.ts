#!/usr/bin/env node
import readline from 'readline';
import { loadAppConfig } from '../config/index.js';
import { ToolRegistry } from '../tools/registry.js';
import { AgentOrchestrator } from '../agent/index.js';
import { SafetyGate } from '../safety/gate.js';
import { BackupManager } from '../safety/backup.js';
import { ProjectMemoryManager } from '../memory/project.js';
import { PlanningManager } from '../planning/planner.js';
import { SkillLoader } from '../skills/loader.js';
import { SessionManager } from '../memory/session.js';
import { buildIgnoreFilter } from './gitignore-filter.js';
import { runOnboarding } from './onboarding.js';
import { buildCompleter } from './autocomplete.js';
import { CliSpinner } from './spinner.js';
import { CliContext } from './context.js';
import { onConfirmDangerousTool, saveSessionMemoryAndExit, promptUser } from './repl.js';
import { colors } from './colors.js';

/**
 * Main CLI entry point.
 */
function printJustCodeASCII() {
  console.log(`
${colors.cyan}${colors.bold}     _             _                  _      
    | |           | |                | |     
    | |_   _  ___ | |_  ___  ___   __| | ___ 
 _  | | | | |/ __|| __|/ __|/ _ \\ / _\` |/ _ \\
| |_| | |_| |\\__ \\| |_| (__| (_) | (_| |  __/
 \\___/ \\__,_||___/ \\__|\\___|\\___/ \\__,_|\\___|${colors.reset}`)
}

function printIntroduction() {
  console.log(`  ${colors.cyan}${colors.bold}justcode${colors.reset} ${colors.dim}v0.1.0${colors.reset} • ${colors.italic}${colors.gray}Terminal-based agentic coding assistant${colors.reset}
  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}
  Type ${colors.bold}${colors.cyan}/help${colors.reset} for instructions or ${colors.bold}${colors.cyan}/list${colors.reset} to view all slash commands.
  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}
`);
}
async function main() {
  printJustCodeASCII();
  printIntroduction();

  const context: CliContext = {
    rl: null as any,
    orchestrator: null as any,
    sessionManager: new SessionManager(),
    spinner: new CliSpinner(),
    backupManager: new BackupManager(),
    skillLoader: new SkillLoader(),
    projectMemory: null as any,
    planningManager: null as any,
    conversationHistory: [],
    sessionId: String(Date.now()),
    sessionCost: 0,
    debugMode: true,
    pinnedSkills: new Set<string>(),
    mutedSkills: new Set<string>(),
    lastCollapsedOutput: null,
    skillNames: [],
    saveSessionMemoryAndExit: null as any,
    resumePrompt: null as any,
  };

  let config = loadAppConfig();

  // Onboarding prompt if missing API keys
  const hasLocalOpenAi = config.openaiEndpoint?.includes('localhost') || config.openaiEndpoint?.includes('127.0.0.1');
  if (!config.anthropicApiKey && !config.openaiApiKey && !hasLocalOpenAi) {
    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    config = await runOnboarding(tempRl);
    tempRl.close();
  }

  // Validate active provider credentials
  const activeSmartConfig = config.modelAliases.smart;
  const providerName = activeSmartConfig.provider;
  let isValid = true;
  let errorMsg = '';

  if (config.providers && config.providers[providerName]) {
    if (!config.providers[providerName].apiKey) {
      isValid = false;
      errorMsg = `Error: API key for provider "${providerName}" is not set in configuration.`;
    }
  } else {
    if (providerName === 'anthropic' && !config.anthropicApiKey) {
      isValid = false;
      errorMsg = 'Error: ANTHROPIC_API_KEY is not set but is required by the active "smart" model provider.\n' +
        'Please set it using: $env:ANTHROPIC_API_KEY="your-key" in PowerShell or set ANTHROPIC_API_KEY="your-key" in Command Prompt';
    } else if (providerName === 'openai-compat') {
      const isLocal = config.openaiEndpoint?.includes('localhost') || config.openaiEndpoint?.includes('127.0.0.1');
      if (!config.openaiApiKey && !isLocal) {
        isValid = false;
        errorMsg = 'Error: OPENAI_API_KEY is not set but is required by the active "smart" OpenAI provider.\n' +
          'Please set it using: $env:OPENAI_API_KEY="your-key" in PowerShell or set OPENAI_API_KEY="your-key" in Command Prompt';
      }
    } else if (!config.anthropicApiKey) {
      isValid = false;
      errorMsg = `Error: ANTHROPIC_API_KEY is not set but is required as a fallback for provider "${providerName}".`;
    }
  }

  if (!isValid) {
    console.error(errorMsg);
    process.exit(1);
  }

  // Initialize remaining components
  const registry = new ToolRegistry();
  const safetyGate = new SafetyGate();
  context.projectMemory = new ProjectMemoryManager(config);
  context.planningManager = new PlanningManager(config);
  context.orchestrator = new AgentOrchestrator({
    config,
    registry,
    safetyGate,
    backupManager: context.backupManager,
    onConfirmDangerousTool: onConfirmDangerousTool(context),
    pinnedSkills: context.pinnedSkills,
    mutedSkills: context.mutedSkills,
  });

  context.saveSessionMemoryAndExit = () => saveSessionMemoryAndExit(context);

  // Tab completion filter
  const isIgnored = buildIgnoreFilter(process.cwd());
  const completer = buildCompleter(() => context.skillNames, isIgnored);

  context.rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  });

  registry.setReadline(context.rl);

  // SIGINT handler
  context.rl.on('SIGINT', async () => {
    await context.saveSessionMemoryAndExit();
  });

  // Preload skill names for autocompleter
  context.skillLoader.loadSkills().then((skills) => {
    context.skillNames = skills.map((s) => s.name);
  }).catch(() => { });

  const startLoop = promptUser(context);
  context.resumePrompt = startLoop;
  startLoop();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
