import readline from 'readline';
import { ConversationMessage } from '../providers/types.js';
import { AgentOrchestrator } from '../agent/index.js';
import { CliSpinner } from './spinner.js';
import { BackupManager } from '../safety/backup.js';
import { PlanningManager } from '../planning/planner.js';

export interface CliContext {
  rl: readline.Interface;
  orchestrator: AgentOrchestrator;
  spinner: CliSpinner;
  backupManager: BackupManager;
  planningManager: PlanningManager;
  conversationHistory: ConversationMessage[];
  sessionId: string;
  sessionCost: number;
  debugMode: boolean;
  pinnedSkills: Set<string>;
  mutedSkills: Set<string>;
  lastCollapsedOutput: string | null;
  skillNames: string[];
  saveSessionMemoryAndExit: () => Promise<void>;
  resumePrompt: () => void;
}
