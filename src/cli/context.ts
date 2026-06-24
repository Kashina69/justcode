import readline from 'readline';
import { ConversationMessage } from '../providers/types.js';
import { AgentOrchestrator } from '../agent/index.js';
import { SessionManager } from '../memory/session.js';
import { CliSpinner } from './spinner.js';
import { BackupManager } from '../safety/backup.js';
import { SkillLoader } from '../skills/loader.js';
import { ProjectMemoryManager } from '../memory/project.js';
import { PlanningManager } from '../planning/planner.js';

/**
 * Shared state context for the interactive CLI REPL session.
 */
export interface CliContext {
  rl: readline.Interface;
  orchestrator: AgentOrchestrator;
  sessionManager: SessionManager;
  spinner: CliSpinner;
  backupManager: BackupManager;
  skillLoader: SkillLoader;
  projectMemory: ProjectMemoryManager;
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
