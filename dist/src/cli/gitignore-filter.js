import fsSync from 'fs';
import path from 'path';
/**
 * Builds a filter function that returns true if a given relative path should be ignored,
 * based on .gitignore content merged with hardcoded common patterns.
 * Used by the tab completer to exclude irrelevant paths from suggestions.
 */
export function buildIgnoreFilter(projectRoot) {
    // Always-ignored patterns regardless of .gitignore
    const patterns = [
        'node_modules', '.git', 'dist', '.agent', '.logs',
        'coverage', '.next', 'build', 'package-lock.json', '.DS_Store',
    ];
    try {
        const gitignorePath = path.join(projectRoot, '.gitignore');
        const content = fsSync.readFileSync(gitignorePath, 'utf-8');
        const lines = content
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
        // Strip trailing slashes and leading **/
        patterns.push(...lines.map((l) => l.replace(/\/$/, '').replace(/^\*\//, '')));
    }
    catch {
        // No .gitignore — hardcoded list applies
    }
    return (relPath) => {
        const normalized = relPath.replace(/\\/g, '/');
        return patterns.some((p) => {
            if (!p)
                return false;
            const clean = p.replace(/\*$/, '').replace(/\/$/, '');
            return (normalized === clean ||
                normalized.startsWith(clean + '/') ||
                normalized.includes('/' + clean + '/') ||
                normalized.endsWith('/' + clean));
        });
    };
}
