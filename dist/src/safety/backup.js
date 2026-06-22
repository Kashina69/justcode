import fs from 'fs/promises';
import path from 'path';
export class BackupManager {
    projectRoot;
    backupDir;
    history = [];
    backupCounter = 0;
    /**
     * Initializes the backup manager under the specified project root.
     *
     * @param projectRoot Root directory, defaults to current working directory.
     */
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
        this.backupDir = path.join(this.projectRoot, '.agent', 'backups');
    }
    /**
     * Creates a backup of the file at the specified path before write or edit operations.
     *
     * @param targetPath Absolute or relative path to the file.
     * @returns BackupEntry representing the backup state, or null if failed.
     */
    async createBackup(targetPath) {
        try {
            const resolvedPath = path.resolve(this.projectRoot, targetPath);
            // Ensure backups directory exists
            await fs.mkdir(this.backupDir, { recursive: true });
            let exists = false;
            let originalContent = '';
            let backupPath;
            try {
                await fs.access(resolvedPath);
                exists = true;
                originalContent = await fs.readFile(resolvedPath, 'utf-8');
                this.backupCounter++;
                const backupFileName = `${Date.now()}_${this.backupCounter}_${path.basename(resolvedPath)}`;
                backupPath = path.join(this.backupDir, backupFileName);
                await fs.writeFile(backupPath, originalContent, 'utf-8');
            }
            catch {
                // File does not exist
            }
            const entry = {
                filePath: resolvedPath,
                exists,
                backupPath,
                originalContent: exists ? originalContent : undefined,
            };
            this.history.push(entry);
            return entry;
        }
        catch (error) {
            console.error('Failed to create file backup:', error);
            return null;
        }
    }
    /**
     * Restores the file modified in the last operation to its original state.
     *
     * @returns A promise resolving to true if undo was successful, false otherwise.
     */
    async undoLast() {
        const lastEntry = this.history.pop();
        if (!lastEntry) {
            return false;
        }
        try {
            if (lastEntry.exists && lastEntry.originalContent !== undefined) {
                await fs.writeFile(lastEntry.filePath, lastEntry.originalContent, 'utf-8');
            }
            else {
                // If file did not exist, delete it
                await fs.unlink(lastEntry.filePath).catch(() => { });
            }
            return true;
        }
        catch (error) {
            console.error(`Failed to undo changes for file "${lastEntry.filePath}":`, error);
            return false;
        }
    }
}
