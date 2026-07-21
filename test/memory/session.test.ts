import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadSessionData,
  updateStats,
  saveSessionHistory,
  loadSessionHistory,
  updateSessionSummary,
} from '../../src/memory/session.js';
import fs from 'fs';
import path from 'path';

describe('session functions', () => {
  const testRoot = path.resolve('test_session_temp');
  const origCwd = process.cwd;

  beforeEach(() => {
    process.cwd = () => testRoot;
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    process.cwd = origCwd;
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should initialize empty stats when file does not exist', async () => {
    const data = await loadSessionData(testRoot);
    expect(data.projectStats.totalInputTokens).toBe(0);
    expect(data.projectStats.totalCostUsd).toBe(0);
    expect(data.sessions).toEqual([]);
  });

  it('should save and load session stats dynamically', async () => {
    const sessionId = 'test-session-123';

    await updateStats(sessionId, 1000, 500, 0.0035, testRoot);

    const data = await loadSessionData(testRoot);
    expect(data.projectStats.totalInputTokens).toBe(1000);
    expect(data.projectStats.totalOutputTokens).toBe(500);
    expect(data.projectStats.totalCostUsd).toBe(0.0035);

    expect(data.sessions.length).toBe(1);
    expect(data.sessions[0].id).toBe(sessionId);
    expect(data.sessions[0].inputTokens).toBe(1000);
    expect(data.sessions[0].costUsd).toBe(0.0035);

    await updateStats(sessionId, 200, 100, 0.0005, testRoot);
    const updated = await loadSessionData(testRoot);
    expect(updated.projectStats.totalInputTokens).toBe(1200);
    expect(updated.sessions[0].inputTokens).toBe(1200);
    expect(updated.sessions[0].costUsd).toBe(0.0040);
  });

  it('should save and load conversation history', async () => {
    const sessionId = 'test-session-456';
    const mockHistory = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi there' },
    ];

    await saveSessionHistory(sessionId, mockHistory as any, testRoot);
    const loaded = await loadSessionHistory(sessionId, testRoot);
    expect(loaded).toEqual(mockHistory);
  });

  it('should update session summaries successfully', async () => {
    const sessionId = 'test-session-789';

    await updateStats(sessionId, 50, 50, 0.0001, testRoot);
    await updateSessionSummary(sessionId, 'Completed server mock setup.', testRoot);

    const data = await loadSessionData(testRoot);
    expect(data.sessions[0].summary).toBe('Completed server mock setup.');
  });
});
