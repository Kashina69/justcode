import fs from 'fs/promises';
import path from 'path';
import { ConversationMessage } from '../providers/types.js';
import { AppConfig } from '../config/index.js';
import { getProviderForAlias } from '../providers/factory.js';

export interface FileIndexEntry {
  path: string;
  summary: string;
  hash: string;
  lastModified: number;
}

export class ProjectMemoryManager {
  private projectRoot: string;
  private agentDir: string;
  private config: AppConfig;

  /**
   * Initializes the ProjectMemoryManager.
   * 
   * @param config The application configuration context.
   * @param projectRoot Target project directory, defaults to current working directory.
   */
  constructor(config: AppConfig, projectRoot: string = process.cwd()) {
    this.config = config;
    this.projectRoot = path.resolve(projectRoot);
    this.agentDir = path.join(this.projectRoot, '.agent');
  }

  /**
   * Loads the project memory prose from .agent/memory.md.
   * 
   * @returns A promise resolving to the memory text, or empty string.
   */
  async loadMemory(): Promise<string> {
    const memoryPath = path.join(this.agentDir, 'memory.md');
    try {
      return await fs.readFile(memoryPath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Appends a new timestamped prose note to the memory log.
   * 
   * @param note The description of the decision or updates.
   */
  async appendMemory(note: string): Promise<void> {
    const memoryPath = path.join(this.agentDir, 'memory.md');
    const timestamp = new Date().toISOString();
    const formattedNote = `\n[${timestamp}] - ${note}\n`;

    try {
      await fs.mkdir(this.agentDir, { recursive: true });
      await fs.appendFile(memoryPath, formattedNote, 'utf-8');
    } catch (error) {
      console.error('Failed to append to project memory:', error);
    }
  }

  /**
   * Loads the file index metadata from .agent/index.json.
   * 
   * @returns A promise resolving to the record of files.
   */
  async loadIndex(): Promise<Record<string, FileIndexEntry>> {
    const indexPath = path.join(this.agentDir, 'index.json');
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.files || {};
    } catch {
      return {};
    }
  }

  /**
   * Saves the file index metadata to .agent/index.json.
   * 
   * @param files The dictionary of index entries.
   */
  async saveIndex(files: Record<string, FileIndexEntry>): Promise<void> {
    const indexPath = path.join(this.agentDir, 'index.json');
    try {
      await fs.mkdir(this.agentDir, { recursive: true });
      await fs.writeFile(indexPath, JSON.stringify({ files }, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save project index:', error);
    }
  }

  /**
   * Triggers the fast model provider to generate a short, high-level summary of the session history.
   * 
   * @param history The conversation message history.
   * @returns A promise resolving to the session summary text.
   */
  async createSessionSummary(history: ConversationMessage[]): Promise<string> {
    if (history.length === 0) {
      return 'Empty session conversation.';
    }

    const provider = getProviderForAlias('fast', this.config);

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

    const systemPrompt =
      'You are a technical documenter. Read the conversation history transcript and summarize the primary ' +
      'goals achieved, files changed, and major architectural decisions made by the developer in a single, ' +
      'concise markdown paragraph. Focus on why changes were made and what was resolved. Do not include introductory text.';

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

  /**
   * Saves the generated session summary text to a markdown file in .agent/sessions/.
   * 
   * @param summary The markdown summary text.
   */
  async saveSessionSummary(summary: string): Promise<void> {
    const sessionsDir = path.join(this.agentDir, 'sessions');
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
}
