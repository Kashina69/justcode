import fs from 'fs/promises';
import path from 'path';
import { ConversationMessage } from '../providers/types.js';

export interface SessionMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  summary: string;
}

export interface ProjectSessionData {
  projectStats: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
  };
  sessions: SessionMetadata[];
}

export class SessionManager {
  private agentDir: string;
  private sessionJsonPath: string;
  private sessionsDir: string;

  /**
   * Initializes the SessionManager for a targeted project root.
   * 
   * @param projectRoot Target project directory, defaults to current working directory.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.agentDir = path.join(projectRoot, '.agent');
    this.sessionJsonPath = path.join(this.agentDir, 'session.json');
    this.sessionsDir = path.join(this.agentDir, 'sessions');
  }

  /**
   * Loads the session.json project-level session catalog data.
   * 
   * @returns A promise resolving to the ProjectSessionData structure.
   */
  public async loadSessionData(): Promise<ProjectSessionData> {
    try {
      const data = await fs.readFile(this.sessionJsonPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {
        projectStats: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUsd: 0,
        },
        sessions: [],
      };
    }
  }

  /**
   * Writes the project-level session metadata catalog to session.json.
   * 
   * @param data The ProjectSessionData payload to serialize.
   */
  public async saveSessionData(data: ProjectSessionData): Promise<void> {
    await fs.mkdir(this.agentDir, { recursive: true });
    await fs.writeFile(this.sessionJsonPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Dynamically increments project-level and session-specific stats.
   * 
   * @param sessionId Target session ID string.
   * @param inputTokens Count of input tokens.
   * @param outputTokens Count of output tokens.
   * @param costUsd Count of estimated cost.
   */
  public async updateStats(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number
  ): Promise<void> {
    const data = await this.loadSessionData();

    // Increment global project metrics
    data.projectStats.totalInputTokens += inputTokens;
    data.projectStats.totalOutputTokens += outputTokens;
    data.projectStats.totalCostUsd += costUsd;

    // Find or create session record
    let session = data.sessions.find((s) => s.id === sessionId);
    if (!session) {
      session = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        summary: 'Active conversation...',
      };
      data.sessions.push(session);
    }

    session.inputTokens += inputTokens;
    session.outputTokens += outputTokens;
    session.costUsd += costUsd;
    session.updatedAt = new Date().toISOString();

    await this.saveSessionData(data);
  }

  /**
   * Saves the full message conversation history list to dist as session JSON.
   * 
   * @param sessionId Session ID identifier.
   * @param history Message history conversation logs.
   */
  public async saveSessionHistory(sessionId: string, history: ConversationMessage[]): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    const historyPath = path.join(this.sessionsDir, `session_${sessionId}.json`);
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }

  /**
   * Loads the full message conversation history list from JSON.
   * 
   * @param sessionId Session ID identifier.
   * @returns A promise resolving to the loaded array of ConversationMessages.
   */
  public async loadSessionHistory(sessionId: string): Promise<ConversationMessage[]> {
    const historyPath = path.join(this.sessionsDir, `session_${sessionId}.json`);
    const data = await fs.readFile(historyPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Updates the summary block for a session entry in session.json.
   * 
   * @param sessionId Target session ID.
   * @param summary The markdown session summary.
   */
  public async updateSessionSummary(sessionId: string, summary: string): Promise<void> {
    const data = await this.loadSessionData();
    const session = data.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.summary = summary;
      session.updatedAt = new Date().toISOString();
      await this.saveSessionData(data);
    }
  }
}
