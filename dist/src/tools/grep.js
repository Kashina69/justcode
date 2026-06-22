import fs from 'fs/promises';
import path from 'path';
export class GrepTool {
    definition = {
        name: 'grep',
        description: 'Searches for text patterns inside files in a directory recursively (ignores node_modules and .git by default).',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'The text string or regex pattern to search for.',
                },
                path: {
                    type: 'string',
                    description: 'The directory path to search in (defaults to current project root).',
                },
            },
            required: ['pattern'],
        },
    };
    /**
     * Recursively searches for patterns in text files.
     *
     * @param args The input arguments containing search pattern and optional directory path.
     * @returns A promise resolving to the grep match summary.
     */
    async execute(args) {
        try {
            const searchDir = path.resolve(args.path || process.cwd());
            const regex = new RegExp(args.pattern, 'i'); // Case-insensitive matching by default
            const results = [];
            await this.searchDirRecursive(searchDir, regex, results);
            if (results.length === 0) {
                return `No matches found for pattern "${args.pattern}".`;
            }
            // Cap results to prevent bloating conversation context
            const maxResults = 100;
            if (results.length > maxResults) {
                return `${results.slice(0, maxResults).join('\n')}\n\n... and ${results.length - maxResults} more matches.`;
            }
            return results.join('\n');
        }
        catch (error) {
            return `Error executing grep: ${error.message}`;
        }
    }
    /**
     * Recursively walks files in a directory and applies pattern matching.
     *
     * @param dir Directory path to search.
     * @param regex Search pattern regular expression.
     * @param results Array collecting matching lines.
     */
    async searchDirRecursive(dir, regex, results) {
        let entries = [];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            // Skip common build/dependency directories
            if (entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === '.agent' ||
                entry.name === 'dist' ||
                entry.name === '.logs') {
                continue;
            }
            if (entry.isDirectory()) {
                await this.searchDirRecursive(fullPath, regex, results);
            }
            else if (entry.isFile()) {
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    // Simple heuristic to skip binary files
                    if (content.includes('\u0000')) {
                        continue;
                    }
                    const lines = content.split(/\r?\n/);
                    for (let i = 0; i < lines.length; i++) {
                        if (regex.test(lines[i])) {
                            const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
                            results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
                        }
                    }
                }
                catch {
                    // Ignore files we cannot read (e.g. locks or permissions issues)
                }
            }
        }
    }
}
