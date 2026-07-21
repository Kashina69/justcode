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

function sessionJsonPath(projectRoot: string): string {
  return path.join(projectRoot, '.agent', 'session.json');
}

function sessionsDir(projectRoot: string): string {
  return path.join(projectRoot, '.agent', 'sessions');
}

export async function loadSessionData(projectRoot: string = process.cwd()): Promise<ProjectSessionData> {
  try {
    const data = await fs.readFile(sessionJsonPath(projectRoot), 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      projectStats: { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0 },
      sessions: [],
    };
  }
}

export async function saveSessionData(data: ProjectSessionData, projectRoot: string = process.cwd()): Promise<void> {
  const fp = sessionJsonPath(projectRoot);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(data, null, 2), 'utf-8');
}

export async function updateStats(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  projectRoot: string = process.cwd(),
): Promise<void> {
  const data = await loadSessionData(projectRoot);
  data.projectStats.totalInputTokens += inputTokens;
  data.projectStats.totalOutputTokens += outputTokens;
  data.projectStats.totalCostUsd += costUsd;

  let session = data.sessions.find(s => s.id === sessionId);
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

  await saveSessionData(data, projectRoot);
}

export async function saveSessionHistory(sessionId: string, history: ConversationMessage[], projectRoot: string = process.cwd()): Promise<void> {
  const dir = sessionsDir(projectRoot);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `session_${sessionId}.json`), JSON.stringify(history, null, 2), 'utf-8');
}

export async function loadSessionHistory(sessionId: string, projectRoot: string = process.cwd()): Promise<ConversationMessage[]> {
  const data = await fs.readFile(path.join(sessionsDir(projectRoot), `session_${sessionId}.json`), 'utf-8');
  return JSON.parse(data);
}

export async function updateSessionSummary(sessionId: string, summary: string, projectRoot: string = process.cwd()): Promise<void> {
  const data = await loadSessionData(projectRoot);
  const session = data.sessions.find(s => s.id === sessionId);
  if (session) {
    session.summary = summary;
    session.updatedAt = new Date().toISOString();
    await saveSessionData(data, projectRoot);
  }
}
