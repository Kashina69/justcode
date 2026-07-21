#!/usr/bin/env node
import readline from 'readline';
import { ToolRegistry } from '../tools/registry.js';
import { AgentOrchestrator } from '../agent/index.js';
import { BackupManager } from '../safety/backup.js';
import { PlanningManager } from '../planning/planner.js';
import { loadSkills } from '../skills/loader.js';
import { buildIgnoreFilter } from './gitignore-filter.js';
import { buildCompleter } from './autocomplete.js';
import { CliSpinner } from './spinner.js';
import { CliContext } from './context.js';
import { onConfirmDangerousTool, saveSessionMemoryAndExit, promptUser } from './repl.js';
import { colors } from './colors.js';
import { ensureAppConfigured } from '../onboarding/index.js';


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

/**
 * Main CLI entry point.
 */
async function main() {
  printJustCodeASCII();
  printIntroduction();

  const context: CliContext = {
    rl: null as any,
    orchestrator: null as any,
    spinner: new CliSpinner(),
    backupManager: new BackupManager(),
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

  const config = await ensureAppConfigured();

  // Initialize remaining components
  const registry = new ToolRegistry();
  context.planningManager = new PlanningManager(config);
  context.orchestrator = new AgentOrchestrator({
    config,
    registry,
    projectRoot: process.cwd(),
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
  loadSkills().then((skills) => {
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
