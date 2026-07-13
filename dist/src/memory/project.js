import fs from 'fs/promises';
import path from 'path';
import { getProviderForAlias } from '../providers/factory.js';
import { readTemplateSync } from '../config/prompts.js';
export class ProjectMemoryManager {
    projectRoot;
    agentDir;
    config;
    /**
     * Initializes the ProjectMemoryManager.
     *
     * @param config The application configuration context.
     * @param projectRoot Target project directory, defaults to current working directory.
     */
    constructor(config, projectRoot = process.cwd()) {
        this.config = config;
        this.projectRoot = path.resolve(projectRoot);
        this.agentDir = path.join(this.projectRoot, '.agent');
    }
    /**
     * Loads the project memory prose from .agent/memory.md.
     *
     * @returns A promise resolving to the memory text, or empty string.
     */
    async loadMemory() {
        const memoryPath = path.join(this.agentDir, 'memory.md');
        try {
            return await fs.readFile(memoryPath, 'utf-8');
        }
        catch {
            return '';
        }
    }
    /**
     * Appends a new timestamped prose note to the memory log.
     *
     * @param note The description of the decision or updates.
     */
    async appendMemory(note) {
        const memoryPath = path.join(this.agentDir, 'memory.md');
        const timestamp = new Date().toISOString();
        const formattedNote = `\n[${timestamp}] - ${note}\n`;
        try {
            await fs.mkdir(this.agentDir, { recursive: true });
            await fs.appendFile(memoryPath, formattedNote, 'utf-8');
        }
        catch (error) {
            console.error('Failed to append to project memory:', error);
        }
    }
    /**
     * Loads the file index metadata from .agent/index.json.
     *
     * @returns A promise resolving to the record of files.
     */
    async loadIndex() {
        const indexPath = path.join(this.agentDir, 'index.json');
        try {
            const data = await fs.readFile(indexPath, 'utf-8');
            const parsed = JSON.parse(data);
            return parsed.files || {};
        }
        catch {
            return {};
        }
    }
    /**
     * Saves the file index metadata to .agent/index.json.
     *
     * @param files The dictionary of index entries.
     */
    async saveIndex(files) {
        const indexPath = path.join(this.agentDir, 'index.json');
        try {
            await fs.mkdir(this.agentDir, { recursive: true });
            await fs.writeFile(indexPath, JSON.stringify({ files }, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Failed to save project index:', error);
        }
    }
    /**
     * Triggers the fast model provider to generate a short, high-level summary of the session history.
     *
     * @param history The conversation message history.
     * @returns A promise resolving to the session summary text.
     */
    async createSessionSummary(history) {
        if (history.length === 0) {
            return 'Empty session conversation.';
        }
        const provider = getProviderForAlias('fast', this.config);
        const messagesDump = history
            .map((msg) => {
            let contentText = '';
            if (typeof msg.content === 'string') {
                contentText = msg.content;
            }
            else if (Array.isArray(msg.content)) {
                contentText = msg.content
                    .map((b) => {
                    if (b.type === 'text')
                        return b.text;
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
        const systemPrompt = readTemplateSync('session_summary_system.txt');
        try {
            const response = await provider.complete({
                systemPrompt,
                messages: [{ role: 'user', content: `Conversation Transcript:\n${messagesDump}` }],
                availableTools: [],
                modelAlias: 'fast',
            });
            return response.textContent.trim();
        }
        catch (error) {
            return `Failed to summarize session automatically: ${error.message}`;
        }
    }
    /**
     * Saves the generated session summary text to a markdown file in .agent/sessions/.
     *
     * @param summary The markdown summary text.
     */
    async saveSessionSummary(summary) {
        const sessionsDir = path.join(this.agentDir, 'sessions');
        const timestamp = Date.now();
        const summaryFileName = `${timestamp}_summary.md`;
        const summaryPath = path.join(sessionsDir, summaryFileName);
        try {
            await fs.mkdir(sessionsDir, { recursive: true });
            await fs.writeFile(summaryPath, summary, 'utf-8');
        }
        catch (error) {
            console.error('Failed to save session summary:', error);
        }
    }
}
