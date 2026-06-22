import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionLogger } from '../../src/memory/logger.js';
import fs from 'fs';
import path from 'path';
describe('SessionLogger', () => {
    const originalCwd = process.cwd;
    const mockCwdPath = path.resolve('test_session_logger_cwd');
    beforeEach(() => {
        // Mock process.cwd to return our temporary test folder
        process.cwd = () => mockCwdPath;
        if (fs.existsSync(mockCwdPath)) {
            fs.rmSync(mockCwdPath, { recursive: true, force: true });
        }
        fs.mkdirSync(mockCwdPath, { recursive: true });
    });
    afterEach(() => {
        process.cwd = originalCwd;
        vi.restoreAllMocks();
        if (fs.existsSync(mockCwdPath)) {
            fs.rmSync(mockCwdPath, { recursive: true, force: true });
        }
    });
    it('should initialize logs directory, create gitignore entry, and log system events', () => {
        // Write a dummy gitignore first
        const gitignorePath = path.join(mockCwdPath, '.gitignore');
        fs.writeFileSync(gitignorePath, 'node_modules\n', 'utf-8');
        // Get the logger instance
        const logger = SessionLogger.getInstance();
        expect(logger).toBeDefined();
        // Check directory and gitignore
        const logsDir = path.join(mockCwdPath, '.logs');
        expect(fs.existsSync(logsDir)).toBe(true);
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        expect(gitignoreContent).toContain('.logs');
        // Get created log files
        const logFiles = fs.readdirSync(logsDir);
        expect(logFiles.length).toBe(1);
        expect(logFiles[0]).toContain('session_');
        const activeLogPath = path.join(logsDir, logFiles[0]);
        const initContent = fs.readFileSync(activeLogPath, 'utf-8');
        expect(initContent).toContain('Session log initiated.');
        // Log request
        logger.logRequest('https://api.test.com/v1', { test: true });
        // Log response
        logger.logResponse({ result: 'ok' }, 150);
        // Log error
        logger.logError('Testing failure', new Error('Something broke'));
        const updatedContent = fs.readFileSync(activeLogPath, 'utf-8');
        expect(updatedContent).toContain('==================== API REQUEST ====================');
        expect(updatedContent).toContain('https://api.test.com/v1');
        expect(updatedContent).toContain('==================== API RESPONSE ====================');
        expect(updatedContent).toContain('Duration: 150ms');
        expect(updatedContent).toContain('[ERROR]');
        expect(updatedContent).toContain('Testing failure');
        expect(updatedContent).toContain('Something broke');
    });
});
