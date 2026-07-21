import { colors } from './colors.js';
import { selectOption } from './select-option.js';
import { CliContext } from './context.js';
import { loadSessionData, loadSessionHistory } from '../memory/session.js';

/**
 * Loads conversation messages and resumes state for a specific session ID.
 *
 * @param context The active CLI context.
 * @param targetId The session identifier to load.
 */
export const resumeSessionById = async (context: CliContext, targetId: string) => {
  try {
    const data = await loadSessionData();
    const targetSession = data.sessions.find((s) => s.id === targetId);
    if (!targetSession) {
      console.log(`Error: Could not find session with ID "${targetId}" in project history.`);
      return;
    }

    if (context.spinner.active()) {
      context.spinner.stop();
    }

    context.conversationHistory = await loadSessionHistory(targetId);
    context.sessionId = targetId;
    context.sessionCost = targetSession.costUsd;

    console.log(`${colors.green}✅ Session "${targetId}" successfully resumed.${colors.reset}`);
    console.log(`   Restored ${context.conversationHistory.length} messages. Cumulative cost: $${context.sessionCost.toFixed(6)} USD.`);
  } catch (err: any) {
    console.error(`Error loading session history for "${targetId}":`, err.message || err);
  }
};

/**
 * Interactive menu to display, choose, and restore a session from history.
 *
 * @param context The active CLI context.
 * @param resumePrompt Callback to resume prompt input loop.
 */
export const handleSessionsMenu = async (context: CliContext, resumePrompt: () => void) => {
  try {
    const data = await loadSessionData();
    console.log('\n📊 Project Global Session Stats:');
    console.log(`  Total Project Input Tokens:   ${data.projectStats.totalInputTokens.toLocaleString()}`);
    console.log(`  Total Project Output Tokens:  ${data.projectStats.totalOutputTokens.toLocaleString()}`);
    console.log(`  Total Project Estimated Cost: $${data.projectStats.totalCostUsd.toFixed(6)} USD`);

    if (data.sessions.length === 0) {
      console.log('\n📁 No saved resumable chat sessions found.');
      resumePrompt();
      return;
    }

    const options = data.sessions.map((s) => {
      const activeLabel = s.id === context.sessionId ? ' [ACTIVE]' : '';
      const summarySnippet = s.summary.length > 50 ? s.summary.substring(0, 47) + '...' : s.summary;
      return `[ID: ${s.id}]${activeLabel} ${s.createdAt} | Cost: $${s.costUsd.toFixed(4)} | Summary: "${summarySnippet}"`;
    });
    options.push('[Cancel / Return]');

    const idx = await selectOption('\nSelect a session to resume or load:', options);
    if (idx === options.length - 1) {
      resumePrompt();
      return;
    }

    const selectedSession = data.sessions[idx];
    await resumeSessionById(context, selectedSession.id);
  } catch (err: any) {
    console.error('Error loading sessions menu:', err.message || err);
  }
  resumePrompt();
};
