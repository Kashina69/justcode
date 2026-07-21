import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadMemory,
  appendMemory,
  loadIndex,
  saveIndex,
  createSessionSummary,
  saveSessionSummary,
} from '../../src/memory/project.js';
import { AppConfig } from '../../src/config/index.js';
import fs from 'fs';
import path from 'path';

describe('project memory functions', () => {
  const testRoot = path.resolve('test_project_memory_temp');
  const origCwd = process.cwd;
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
    process.cwd = () => testRoot;
    global.fetch = mockFetch;
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    process.cwd = origCwd;
    vi.restoreAllMocks();
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should load, append, and record decisions in memory.md', async () => {
    let memory = await loadMemory(testRoot);
    expect(memory).toBe('');

    await appendMemory('Decided to use vitest.', testRoot);
    memory = await loadMemory(testRoot);
    expect(memory).toContain('Decided to use vitest.');
  });

  it('should read and write file index in index.json', async () => {
    let index = await loadIndex(testRoot);
    expect(index).toEqual({});

    const entry = {
      path: 'src/main.ts',
      summary: 'Entry point file',
      hash: 'sha256-hash-value',
      lastModified: 10002003,
    };

    await saveIndex({ 'src/main.ts': entry }, testRoot);
    index = await loadIndex(testRoot);
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

    const summary = await createSessionSummary(
      [
        { role: 'user' as const, content: 'Say hello' },
        { role: 'assistant' as const, content: 'Hello there' },
      ],
      dummyConfig
    );

    expect(summary).toBe('Auto generated session summary text.');

    await saveSessionSummary(summary, testRoot);

    const sessionsDir = path.join(testRoot, '.agent', 'sessions');
    expect(fs.existsSync(sessionsDir)).toBe(true);

    const files = fs.readdirSync(sessionsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toContain('_summary.md');

    const fileContent = fs.readFileSync(path.join(sessionsDir, files[0]), 'utf-8');
    expect(fileContent).toBe('Auto generated session summary text.');
  });
});
