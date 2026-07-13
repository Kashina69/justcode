// @ts-ignore
import { glob } from 'fs/promises';
export class GlobTool {
    definition = {
        name: 'glob',
        description: 'Finds files matching a glob pattern (e.g. "src/**/*.ts").',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'The glob pattern to match (e.g. "**/*.json").',
                },
            },
            required: ['pattern'],
        },
    };
    /**
     * Evaluates glob pattern and returns list of matching files.
     *
     * @param args The input arguments containing the pattern string.
     * @returns A promise resolving to the list of matched files or error.
     */
    async execute(args) {
        try {
            const matches = [];
            // Native glob supports async generator in Node.js 22+
            for await (const entry of glob(args.pattern)) {
                matches.push(entry.replace(/\\/g, '/'));
            }
            if (matches.length === 0) {
                return `No files matched pattern "${args.pattern}".`;
            }
            return matches.join('\n');
        }
        catch (error) {
            return `Error executing glob matching: ${error.message}`;
        }
    }
}
