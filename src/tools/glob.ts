// @ts-ignore
import { glob } from 'fs/promises';
import { Tool } from './types.js';

export class GlobTool implements Tool {
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
  async execute(args: { pattern: string }): Promise<string> {
    try {
      const matches: string[] = [];
      // Native glob supports async generator in Node.js 22+
      for await (const entry of glob(args.pattern)) {
        matches.push(entry.replace(/\\/g, '/'));
      }

      if (matches.length === 0) {
        return `No files matched pattern "${args.pattern}".`;
      }

      return matches.join('\n');
    } catch (error: any) {
      return `Error executing glob matching: ${error.message}`;
    }
  }
}
