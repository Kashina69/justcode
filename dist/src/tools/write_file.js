import fs from 'fs/promises';
import path from 'path';
export class WriteFileTool {
    definition = {
        name: 'write_file',
        description: 'Writes complete contents to a file at the specified path. Creates parent directories if they do not exist.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to write, relative or absolute.',
                },
                content: {
                    type: 'string',
                    description: 'The content to write to the file.',
                },
            },
            required: ['path', 'content'],
        },
    };
    /**
     * Writes the specified content to the target file.
     *
     * @param args The input arguments containing path and content.
     * @returns A promise resolving to a success message or error details.
     */
    async execute(args) {
        try {
            const resolvedPath = path.resolve(args.path);
            // Ensure the parent directory exists
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            await fs.writeFile(resolvedPath, args.content, 'utf-8');
            return `File successfully written to "${args.path}".`;
        }
        catch (error) {
            return `Error writing file at path "${args.path}": ${error.message}`;
        }
    }
}
