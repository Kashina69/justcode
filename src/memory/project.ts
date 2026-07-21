import fs from 'fs/promises';
import path from 'path';
import { ConversationMessage } from '../providers/types.js';
import { AppConfig } from '../config/index.js';
import { getProviderForAlias } from '../providers/factory.js';
import { prompts } from '../config/prompts.js';

export interface FileIndexEntry {
  path: string;
  summary: string;
  hash: string;
  lastModified: number;
}

function agentDir(projectRoot: string): string {
  return path.join(projectRoot, '.agent');
}

export async function loadMemory(projectRoot: string = process.cwd()): Promise<string> {
  const memoryPath = path.join(agentDir(projectRoot), 'memory.md');
  try {
    return await fs.readFile(memoryPath, 'utf-8');
  } catch {
    return '';
  }
}

export async function appendMemory(note: string, projectRoot: string = process.cwd()): Promise<void> {
  const memoryPath = path.join(agentDir(projectRoot), 'memory.md');
  const timestamp = new Date().toISOString();
  const formattedNote = `\n[${timestamp}] - ${note}\n`;
  try {
    await fs.mkdir(agentDir(projectRoot), { recursive: true });
    await fs.appendFile(memoryPath, formattedNote, 'utf-8');
  } catch (error) {
    console.error('Failed to append to project memory:', error);
  }
}

export async function loadIndex(projectRoot: string = process.cwd()): Promise<Record<string, FileIndexEntry>> {
  const indexPath = path.join(agentDir(projectRoot), 'index.json');
  try {
    const data = await fs.readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.files || {};
  } catch {
    return {};
  }
}

export async function saveIndex(files: Record<string, FileIndexEntry>, projectRoot: string = process.cwd()): Promise<void> {
  const indexPath = path.join(agentDir(projectRoot), 'index.json');
  try {
    await fs.mkdir(agentDir(projectRoot), { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify({ files }, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save project index:', error);
  }
}

export async function createSessionSummary(history: ConversationMessage[], config: AppConfig): Promise<string> {
  if (history.length === 0) {
    return 'Empty session conversation.';
  }
  const provider = getProviderForAlias('fast', config);
  const messagesDump = history
    .map((msg) => {
      let contentText = '';
      if (typeof msg.content === 'string') {
        contentText = msg.content;
      } else if (Array.isArray(msg.content)) {
        contentText = msg.content
          .map((b) => {
            if (b.type === 'text') return b.text;
            if (b.type === 'tool_use')
              return `[Called tool "${b.name}" with inputs: ${JSON.stringify(b.input)}]`;
            if (b.type === 'tool_result')
              return `[Tool execution output: ${b.content.substring(0, 100)}]`;
            return '';
          })
          .join(' ');
      }
      return `${msg.role.toUpperCase()}: ${contentText.substring(0, 500)}`;
    })
    .join('\n\n');

  const systemPrompt = prompts.get('session_summary_system');

  try {
    const response = await provider.complete({
      systemPrompt,
      messages: [{ role: 'user', content: `Conversation Transcript:\n${messagesDump}` }],
      availableTools: [],
      modelAlias: 'fast',
    });
    return response.textContent.trim();
  } catch (error: any) {
    return `Failed to summarize session automatically: ${error.message}`;
  }
}

export async function saveSessionSummary(summary: string, projectRoot: string = process.cwd()): Promise<void> {
  const sessionsDir = path.join(agentDir(projectRoot), 'sessions');
  const timestamp = Date.now();
  const summaryFileName = `${timestamp}_summary.md`;
  const summaryPath = path.join(sessionsDir, summaryFileName);
  try {
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(summaryPath, summary, 'utf-8');
  } catch (error) {
    console.error('Failed to save session summary:', error);
  }
}
