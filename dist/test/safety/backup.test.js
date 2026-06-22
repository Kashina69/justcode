import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupManager } from '../../src/safety/backup.js';
import fs from 'fs/promises';
import path from 'path';
describe('BackupManager', () => {
    const testFile = path.resolve('test_backup_temp.txt');
    const backupManager = new BackupManager(process.cwd());
    beforeEach(async () => {
        await fs.writeFile(testFile, 'original content', 'utf-8');
    });
    afterEach(async () => {
        await fs.unlink(testFile).catch(() => { });
        // Clean up backups directory
        await fs.rm(path.join(process.cwd(), '.agent', 'backups'), { recursive: true, force: true }).catch(() => { });
    });
    it('should backup and restore existing file', async () => {
        const backup = await backupManager.createBackup(testFile);
        expect(backup).not.toBeNull();
        expect(backup?.exists).toBe(true);
        expect(backup?.originalContent).toBe('original content');
        // Modify the file
        await fs.writeFile(testFile, 'modified content', 'utf-8');
        // Undo the modification
        const restored = await backupManager.undoLast();
        expect(restored).toBe(true);
        const content = await fs.readFile(testFile, 'utf-8');
        expect(content).toBe('original content');
    });
    it('should handle backups for non-existing files and delete on undo', async () => {
        const nonExistentFile = path.resolve('non_existent_test_file.txt');
        await fs.unlink(nonExistentFile).catch(() => { });
        const backup = await backupManager.createBackup(nonExistentFile);
        expect(backup).not.toBeNull();
        expect(backup?.exists).toBe(false);
        // Create the file (simulating write_file)
        await fs.writeFile(nonExistentFile, 'new file content', 'utf-8');
        // Undo creation
        const restored = await backupManager.undoLast();
        expect(restored).toBe(true);
        // File should be deleted
        await expect(fs.access(nonExistentFile)).rejects.toThrow();
    });
});
