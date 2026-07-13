import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../src/memory/session.js';
import fs from 'fs';
import path from 'path';

describe('SessionManager', () => {
  const testRoot = path.resolve('test_session_temp');

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should initialize empty stats when file does not exist', async () => {
    const manager = new SessionManager(testRoot);
    const data = await manager.loadSessionData();

    expect(data.projectStats.totalInputTokens).toBe(0);
    expect(data.projectStats.totalCostUsd).toBe(0);
    expect(data.sessions).toEqual([]);
  });

  it('should save and load session stats dynamically', async () => {
    const manager = new SessionManager(testRoot);
    const sessionId = 'test-session-123';

    await manager.updateStats(sessionId, 1000, 500, 0.0035);

    const data = await manager.loadSessionData();
    expect(data.projectStats.totalInputTokens).toBe(1000);
    expect(data.projectStats.totalOutputTokens).toBe(500);
    expect(data.projectStats.totalCostUsd).toBe(0.0035);

    expect(data.sessions.length).toBe(1);
    expect(data.sessions[0].id).toBe(sessionId);
    expect(data.sessions[0].inputTokens).toBe(1000);
    expect(data.sessions[0].costUsd).toBe(0.0035);

    // Increment again
    await manager.updateStats(sessionId, 200, 100, 0.0005);
    const updated = await manager.loadSessionData();
    expect(updated.projectStats.totalInputTokens).toBe(1200);
    expect(updated.sessions[0].inputTokens).toBe(1200);
    expect(updated.sessions[0].costUsd).toBe(0.0040);
  });

  it('should save and load conversation history', async () => {
    const manager = new SessionManager(testRoot);
    const sessionId = 'test-session-456';
    const mockHistory = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' }
    ];

    await manager.saveSessionHistory(sessionId, mockHistory as any);
    const loaded = await manager.loadSessionHistory(sessionId);

    expect(loaded).toEqual(mockHistory);
  });

  it('should update session summaries successfully', async () => {
    const manager = new SessionManager(testRoot);
    const sessionId = 'test-session-789';

    await manager.updateStats(sessionId, 50, 50, 0.0001);
    await manager.updateSessionSummary(sessionId, 'Completed server mock setup.');

    const data = await manager.loadSessionData();
    expect(data.sessions[0].summary).toBe('Completed server mock setup.');
  });
});
