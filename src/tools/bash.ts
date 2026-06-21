import { exec, ChildProcess } from 'child_process';
import { Tool } from './types.js';

export class BashTool implements Tool {
  // Static registry to track currently running background processes
  public static runningProcesses = new Set<ChildProcess>();

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
   * Spawns all tracked child processes and gracefully terminates them.
   * Useful to prevent port collisions or lingering background daemons on exit.
   */
  public static cleanup(): void {
    for (const child of BashTool.runningProcesses) {
      try {
        // Kill process tree or single process
        child.kill('SIGTERM');
      } catch {
        // Ignore kill errors for dead processes
      }
    }
    BashTool.runningProcesses.clear();
  }

  /**
   * Executes a command in the shell. For servers or long-running operations,
   * it yields control back immediately on server startup logs or resolves
   * into a background process after a dynamic timeout, avoiding locks.
   * 
   * @param args The input arguments containing the command string.
   * @returns A promise resolving to the output stream summary.
   */
  async execute(args: { command: string }): Promise<string> {
    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let resolved = false;

      // Spawns child process execution
      const child = exec(args.command);
      BashTool.runningProcesses.add(child);

      const resolveEarly = (msg: string) => {
        if (!resolved) {
          resolved = true;
          resolve(msg);
        }
      };

      child.stdout?.on('data', (data) => {
        stdoutData += data.toString();
        
        // If it looks like a server started, resolve immediately to unblock agent orchestration
        const lower = data.toString().toLowerCase();
        if (
          lower.includes('server running') ||
          lower.includes('listening on') ||
          lower.includes('started') ||
          lower.includes('ready') ||
          lower.includes('connected') ||
          lower.includes('http://localhost')
        ) {
          resolveEarly(`[Process started in background] Output so far:\n${stdoutData}`);
        }
      });

      child.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('close', (code) => {
        BashTool.runningProcesses.delete(child);
        let output = stdoutData + stderrData;
        if (code !== 0 && code !== null) {
          output += `\nProcess exited with code ${code}`;
        }
        resolveEarly(output || 'Command completed successfully with no output.');
      });

      child.on('error', (err) => {
        BashTool.runningProcesses.delete(child);
        resolveEarly(`Process error: ${err.message}\nOutput:\n${stdoutData + stderrData}`);
      });

      // Configure dynamic timeouts: long waits for builds/installs, short waits for daemons/servers
      let timeoutMs = 6000;
      const cmdLower = args.command.toLowerCase();
      if (
        cmdLower.includes('install') ||
        cmdLower.includes('build') ||
        cmdLower.includes('compile') ||
        cmdLower.includes('test') ||
        cmdLower.includes('vitest')
      ) {
        timeoutMs = 30000;
      }

      setTimeout(() => {
        if (!resolved) {
          // Resolve early but leave child process running in background
          resolveEarly(`[Process is running in background] Output so far:\n${stdoutData + stderrData}`);
        }
      }, timeoutMs);
    });
  }
}
