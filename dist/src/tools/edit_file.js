import fs from 'fs/promises';
import path from 'path';
export class EditFileTool {
    definition = {
        name: 'edit_file',
        description: 'Edits an existing file by replacing specific blocks of text. Edits are applied in the order specified.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The path of the file to edit.',
                },
                edits: {
                    type: 'array',
                    description: 'A list of edit search/replace chunks to execute.',
                    items: {
                        type: 'object',
                        properties: {
                            oldText: {
                                type: 'string',
                                description: 'The exact lines of text to be replaced (must match exactly in the file including whitespace).',
                            },
                            newText: {
                                type: 'string',
                                description: 'The new replacement text.',
                            },
                        },
                        required: ['oldText', 'newText'],
                    },
                },
            },
            required: ['path', 'edits'],
        },
    };
    /**
     * Applies search-and-replace text blocks to the target file.
     *
     * @param args The input arguments matching the schema.
     * @returns A promise resolving to a success message or error details.
     */
    async execute(args) {
        try {
            const resolvedPath = path.resolve(args.path);
            let content = await fs.readFile(resolvedPath, 'utf-8');
            for (let i = 0; i < args.edits.length; i++) {
                const edit = args.edits[i];
                const index = content.indexOf(edit.oldText);
                if (index === -1) {
                    return `Error at edit block #${i + 1}: The target text (oldText) was not found in the file. Ensure whitespace and newlines match exactly.\nTarget oldText was:\n"""\n${edit.oldText}\n"""`;
                }
                // Verify if there are other matching blocks to avoid ambiguity
                const secondIndex = content.indexOf(edit.oldText, index + edit.oldText.length);
                if (secondIndex !== -1) {
                    return `Error at edit block #${i + 1}: The target text (oldText) is not unique. It matches multiple locations in the file. Add more surrounding lines to unique-identify the target block.`;
                }
                // Perform drop-in replacement
                content =
                    content.substring(0, index) +
                        edit.newText +
                        content.substring(index + edit.oldText.length);
            }
            await fs.writeFile(resolvedPath, content, 'utf-8');
            return `Successfully applied ${args.edits.length} edits to file "${args.path}".`;
        }
        catch (error) {
            return `Error editing file at path "${args.path}": ${error.message}`;
        }
    }
}
