import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectMemoryManager } from '../../src/memory/project.js';
import { AppConfig } from '../../src/config/index.js';
import fs from 'fs';
import path from 'path';

describe('ProjectMemoryManager', () => {
  const testRoot = path.resolve('test_project_memory_temp');
  const dummyConfig: AppConfig = {
    anthropicApiKey: undefined,
    openaiApiKey: 'dummy-openai-key',
    openaiEndpoint: 'https://api.openai.com/v1',
    modelAliases: {
      fast: { provider: 'openai-compat', modelId: 'gpt-4o-mini' },
      smart: { provider: 'openai-compat', modelId: 'gpt-4o' },
      planner: { provider: 'openai-compat', modelId: 'gpt-4-turbo' },
    },
  };

  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should load, append, and record decisions in memory.md', async () => {
    const manager = new ProjectMemoryManager(dummyConfig, testRoot);

    // Should return empty string for non-existent memory
    let memory = await manager.loadMemory();
    expect(memory).toBe('');

    // Append memory
    await manager.appendMemory('Decided to use vitest.');
    memory = await manager.loadMemory();
    expect(memory).toContain('Decided to use vitest.');
  });

  it('should read and write file index in index.json', async () => {
    const manager = new ProjectMemoryManager(dummyConfig, testRoot);

    let index = await manager.loadIndex();
    expect(index).toEqual({});

    const entry = {
      path: 'src/main.ts',
      summary: 'Entry point file',
      hash: 'sha256-hash-value',
      lastModified: 10002003,
    };

    await manager.saveIndex({ 'src/main.ts': entry });
    index = await manager.loadIndex();
    expect(index['src/main.ts']).toEqual(entry);
  });

  it('should call fast LLM to generate and save session summary', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Auto generated session summary text.',
            },
          },
        ],
      }),
    });

    const manager = new ProjectMemoryManager(dummyConfig, testRoot);
    const summary = await manager.createSessionSummary([
      { role: 'user', content: 'Say hello' },
      { role: 'assistant', content: 'Hello there' },
    ]);

    expect(summary).toBe('Auto generated session summary text.');

    // Save summary
    await manager.saveSessionSummary(summary);

    // Check if file was saved under .agent/sessions/
    const sessionsDir = path.join(testRoot, '.agent', 'sessions');
    expect(fs.existsSync(sessionsDir)).toBe(true);

    const files = fs.readdirSync(sessionsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toContain('_summary.md');

    const fileContent = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf-8');
    expect(fileContent).toBe('Auto generated session summary text.');
  });
});
