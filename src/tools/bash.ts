import { exec } from 'child_process';
import { Tool } from './types.js';

export class BashTool implements Tool {
  definition = {
    name: 'bash',
    description: 'Executes a command line string in the local system shell and returns the output.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command line to run.',
        },
      },
      required: ['command'],
    },
  };

  /**
   * Executes a command in the shell and returns its standard outputs.
   * 
   * @param args The input arguments containing the command string.
   * @returns A promise resolving to the command output and error (if any).
   */
  async execute(args: { command: string }): Promise<string> {
    return new Promise((resolve) => {
      // Execute the command in the local system shell
      exec(args.command, (error, stdout, stderr) => {
        let output = '';
        if (stdout) {
          output += stdout;
        }
        if (stderr) {
          output += stderr;
        }
        if (error) {
          output += `\nProcess exited with code ${error.code || 1}\nError message: ${error.message}`;
        }
        resolve(output || 'Command executed successfully with no output.');
      });
    });
  }
}
