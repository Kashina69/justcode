import { colors, THEMES, saveTheme } from './colors.js';
import { CliContext } from './context.js';
import { loadMemory } from '../memory/project.js';
import { printCostSummary } from './cost.js';
import { handleModelsMenu } from './models.js';
import { handleConfigMenu } from './config-menu.js';
import { resumeSessionById, handleSessionsMenu } from './sessions.js';
import { handleDbCommand } from './db-menu.js';
import { selectOption } from './select-option.js';
import { loadSkills } from '../skills/loader.js';
import { handleInitCommand } from './init.js';

/**
 * Dispatches and executes slash commands.
 *
 * @param context The active CLI context.
 * @param trimmedInput The developer prompt.
 * @returns Promise resolving to 'sync', 'async', or false.
 */
export const handleCommand = async (
  context: CliContext,
  trimmedInput: string
): Promise<'sync' | 'async' | false> => {
  const lowerInput = trimmedInput.toLowerCase();

  if (lowerInput === 'exit' || lowerInput === 'quit') {
    context.rl.close();
    await context.saveSessionMemoryAndExit();
    return 'async';
  }

  if (lowerInput === '/help') {
    console.log(`\n${colors.bold}${colors.cyan}🤖 justcode Help & Guide:${colors.reset}`);
    console.log('  justcode is an agentic coding assistant that lives in your terminal. You can write');
    console.log('  instructions in natural language, and the agent will plan, execute, and verify code modifications.');
    console.log(`\n  ${colors.bold}Prompting & Usage:${colors.reset}`);
    console.log('    • Type your request (e.g., "Add email validation to user model") and press Enter.');
    console.log('    • The agent will choose the best tools (read, write, search, run shell commands) and execute them.');
    console.log('    • If details are missing, the agent will prompt you with clarifying questions using the ask_user tool.');
    console.log('    • Pin a skill for the session by typing "@skillname" in your message.');
    console.log('    • Mute/ignore a skill for the session by typing "!@skillname" in your message.');
    console.log('    • Inject file context directly by typing "@filepath" or "@filepath:lines" (e.g. "@src/index.ts:10-20").');
    console.log('    • Type "e" or "expand" to view the full content of folded tool outputs.');
    console.log('    • Type "/help" to view this help guide.');
    console.log('    • Type "/list" to see all available slash commands.');
    console.log('    • Type "exit" or "quit" to end the session.');
    return 'sync';
  }

  if (lowerInput === '/list') {
    console.log(`\n${colors.bold}${colors.cyan}📋 Available Slash Commands:${colors.reset}`);
    console.log(`  ${colors.bold}/help${colors.reset}                  Show this general help and guide`);
    console.log(`  ${colors.bold}/list${colors.reset}                  List all available slash commands and their details`);
    console.log(`  ${colors.bold}/config${colors.reset}                Open the interactive configuration editor`);
    console.log(`  ${colors.bold}/models${colors.reset}                Open the interactive model-to-alias mapping menu`);
    console.log(`  ${colors.bold}/sessions${colors.reset}              Open the interactive session history and load menu`);
    console.log(`  ${colors.bold}/skills${colors.reset}                List all available capabilities/skills in the project`);
    console.log(`  ${colors.bold}/skill${colors.reset}                 Manage session-scoped skill configurations:`);
    console.log('                           - /skill list      List status of all skills');
    console.log('                           - /skill pin <name> Pin a skill (always active)');
    console.log('                           - /skill mute <name> Mute a skill (never run)');
    console.log('                           - /skill reset     Clear pins and mutes');
    console.log(`  ${colors.bold}/plan <goal>${colors.reset}           Draft, critique, and save a design plan before execution`);
    console.log(`  ${colors.bold}/plans${colors.reset}                 List active and archived design plans`);
    console.log(`  ${colors.bold}/plans archive <id>${colors.reset}    Archive a specific plan`);
    console.log(`  ${colors.bold}/memory${colors.reset}                Display the project timeline memory (.agent/memory.md)`);
    console.log(`  ${colors.bold}/db${colors.reset}                    Open database administrator and design agent:`);
    console.log('                           - /db setup        Run the database connection wizard');
    console.log('                           - /db schema       Introspect database schema and show diagrams');
    console.log('                           - /db query <sql>  Execute a SQL/NoSQL query (requires y/N for mutations)');
    console.log('                           - /db ask <q>      Ask the DB agent a design/optimization question');
    console.log('                           - /db memory       View database cached schema memory nodes');
    console.log('                           - /db revalidate   Revalidate database schema and record changes');
    console.log(`  ${colors.bold}/cost${colors.reset}                  Show global token statistics and estimated cost summary`);
    console.log(`  ${colors.bold}/undo${colors.reset}                  Roll back the last file modification made by the agent`);
    console.log(`  ${colors.bold}/theme${colors.reset}                 Choose a premium terminal color theme (One Dark, Catppuccin, etc.)`);
    console.log(`  ${colors.bold}/debug <on|off>${colors.reset}        Toggle detailed flow and tool latency trace logging`);
    console.log(`  ${colors.bold}/init${colors.reset}                  Scan project and generate .agents/ context files (project.md, agents.md, taste/, modules/)`);
    console.log(`  ${colors.bold}/analyze${colors.reset}               Initiate codebase analysis to produce project documentation`);

    console.log(`\n${colors.bold}${colors.cyan}✨ Inline Mentions & Context Injections:${colors.reset}`);
    console.log(`  ${colors.bold}@<skillname>${colors.reset}           Pin a skill for the rest of the chat session`);
    console.log(`  ${colors.bold}!@<skillname>${colors.reset}          Mute/ignore a skill for the rest of the chat session`);
    console.log(`  ${colors.bold}@<filepath>${colors.reset}            Inject whole file contents into the chat context`);
    console.log(`  ${colors.bold}@<filepath>:<lines>${colors.reset}      Inject specific line range or line (e.g., @src/index.ts:10-25)`);
    return 'sync';
  }

  if ((lowerInput === 'e' || lowerInput === 'expand') && context.lastCollapsedOutput !== null) {
    console.log(`\n${colors.dim}━━━ Full Output ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(context.lastCollapsedOutput);
    console.log(`${colors.dim}━━━ End Output ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    context.lastCollapsedOutput = null;
    return 'sync';
  }

  if (lowerInput === '/undo') {
    const success = await context.backupManager.undoLast();
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
      const skills = await loadSkills();
      context.skillNames = skills.map((s) => s.name);
      console.log('\n💡 Available Skills:');
      if (skills.length === 0) {
        console.log('  (none)');
      } else {
        skills.forEach((s) => {
          const pinned = context.pinnedSkills.has(s.name) ? ` ${colors.green}[PINNED]${colors.reset}` : '';
          const muted = context.mutedSkills.has(s.name) ? ` ${colors.red}[MUTED]${colors.reset}` : '';
          console.log(`  - ${colors.bold}${s.name}${colors.reset}${pinned}${muted}`);
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
      if (context.skillNames.length === 0) {
        console.log('  (no skills loaded — run /skills first)');
      } else {
        for (const n of context.skillNames) {
          const pinTag = context.pinnedSkills.has(n) ? ` ${colors.green}[PINNED — always active]${colors.reset}` : '';
          const muteTag = context.mutedSkills.has(n) ? ` ${colors.red}[MUTED — always excluded]${colors.reset}` : '';
          const status = !pinTag && !muteTag ? ` ${colors.dim}[auto]${colors.reset}` : '';
          console.log(`  - ${n}${pinTag}${muteTag}${status}`);
        }
      }
      console.log(`\n  ${colors.dim}Use: /skill pin <name>  /skill mute <name>  /skill reset${colors.reset}`);
    } else if (sub === 'pin' && name) {
      context.pinnedSkills.add(name);
      context.mutedSkills.delete(name);
      console.log(`${colors.green}📌 "${name}" pinned — injected on every request this session.${colors.reset}`);
    } else if (sub === 'mute' && name) {
      context.mutedSkills.add(name);
      context.pinnedSkills.delete(name);
      console.log(`${colors.yellow}🔇 "${name}" muted — excluded even if auto-matched.${colors.reset}`);
    } else if (sub === 'reset') {
      context.pinnedSkills.clear();
      context.mutedSkills.clear();
      console.log(`${colors.green}✅ All skill pins and mutes cleared. Back to automatic matching.${colors.reset}`);
    } else {
      console.log('Usage: /skill list | /skill pin <name> | /skill mute <name> | /skill reset');
    }
    return 'sync';
  }

  if (lowerInput.startsWith('/debug')) {
    const arg = trimmedInput.split(/\s+/)[1]?.toLowerCase();
    if (arg === 'on') {
      context.debugMode = true;
      console.log(`${colors.green}🔍 Flow logs ON — internal steps will be shown dim below each request.${colors.reset}`);
    } else if (arg === 'off') {
      context.debugMode = false;
      console.log(`${colors.yellow}🔍 Flow logs OFF.${colors.reset}`);
    } else {
      console.log(`Flow logs: ${context.debugMode ? `${colors.green}ON${colors.reset}` : `${colors.yellow}OFF${colors.reset}`}. Use /debug on|off`);
    }
    return 'sync';
  }

  if (lowerInput === '/memory') {
    try {
      const memory = await loadMemory();
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
      const draft = await context.planningManager.draftPlan(goal);
      console.log('🔍 Critiquing and rewriting plan with smart model...');
      const finalPlan = await context.planningManager.critiqueAndRewrite(draft);

      console.log('\n================ PROPOSED PLAN ================');
      console.log(finalPlan);
      console.log('===============================================\n');

      context.rl.question('\nDo you approve this plan? (y/N): ', async (answer) => {
        const approved = answer.trim().toLowerCase() === 'y';
        if (approved) {
          const planId = `plan_${Date.now()}`;
          await context.planningManager.savePlan(planId, finalPlan);
          console.log(`✅ Plan approved and saved as active: .agent/plans/${planId}.md`);
        } else {
          console.log('❌ Plan rejected.');
        }
        context.resumePrompt();
      });
    } catch (err: any) {
      console.error('❌ Error generating plan:', err.message || err);
      context.resumePrompt();
    }
    return 'async';
  }

  if (lowerInput === '/plans') {
    try {
      const list = await context.planningManager.listPlans();
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
      const success = await context.planningManager.archivePlan(id);
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
    await resumeSessionById(context, targetId);
    return 'sync';
  }

  if (lowerInput === '/sessions' || lowerInput === '/session list') {
    await handleSessionsMenu(context, context.resumePrompt);
    return 'async';
  }

  if (lowerInput === '/models') {
    await handleModelsMenu();
    context.resumePrompt();
    return 'async';
  }

  if (lowerInput === '/config') {
    await handleConfigMenu(context.rl, context.resumePrompt);
    return 'async';
  }

  if (lowerInput.startsWith('/db')) {
    return handleDbCommand(context, trimmedInput);
  }

  if (lowerInput === '/theme') {
    const themeNames = Object.keys(THEMES);
    const selectedIdx = await selectOption('Choose a terminal color theme:', themeNames);
    const chosenTheme = themeNames[selectedIdx];
    saveTheme(chosenTheme);
    console.log(`\n🎨 ${colors.bold}${colors.green}Theme successfully updated to: ${chosenTheme}${colors.reset}\n`);
    return 'sync';
  }

  if (lowerInput === '/init') {
    await handleInitCommand();
    return 'sync';
  }

  return false;
};
