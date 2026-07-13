import fs from 'fs/promises';
import path from 'path';
import { Tool } from './types.js';

export class ReadFileTool implements Tool {
  definition = {
    name: 'read_file',
    description: 'Reads the entire contents of a file at the specified path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path of the file to read, relative or absolute.',
        },
      },
      required: ['path'],
    },
  };

  /**
   * Reads a file from disk and returns its string content.
   * 
   * @param args The input arguments containing the target path.
   * @returns A promise resolving to the file contents or error details.
   */
  async execute(args: { path: string }): Promise<string> {
    try {
      // Direct path resolution for Phase 1. Sandboxing and path constraints will be added in Phase 2.
      const resolvedPath = path.resolve(args.path);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return content;
    } catch (error: any) {
      return `Error reading file at path "${args.path}": ${error.message}`;
    }
  }
}
