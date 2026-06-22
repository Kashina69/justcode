import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logTokenUsage } from '../../src/memory/global.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
describe('GlobalMemoryLogger', () => {
    const testHome = path.resolve('test_global_memory_home');
    beforeEach(() => {
        vi.spyOn(os, 'homedir').mockReturnValue(testHome);
        if (fs.existsSync(testHome)) {
            fs.rmSync(testHome, { recursive: true, force: true });
        }
    });
    afterEach(() => {
        vi.restoreAllMocks();
        if (fs.existsSync(testHome)) {
            fs.rmSync(testHome, { recursive: true, force: true });
        }
    });
    it('should create log file and record token usage', async () => {
        await logTokenUsage('claude-3-5-sonnet-20241022', 100, 200);
        const logPath = path.join(testHome, '.agent', 'usage.log');
        expect(fs.existsSync(logPath)).toBe(true);
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const parsed = JSON.parse(logContent.trim());
        expect(parsed.modelId).toBe('claude-3-5-sonnet-20241022');
        expect(parsed.inputTokens).toBe(100);
        expect(parsed.outputTokens).toBe(200);
        expect(parsed.estimatedCostUsd).toBe(0.0033);
    });
});
