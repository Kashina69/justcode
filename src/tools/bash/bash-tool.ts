import { exec } from 'child_process';
import { Tool } from '../types.js';
import { runningProcesses, JOB_REGISTRY } from './state.js';

export class BashTool implements Tool {
  public static runningProcesses = runningProcesses;

  definition = {
    name: 'bash',
    description:
      'Executes a shell command and returns its output. ' +
      'For commands expected to take more than a few seconds (npm install, build, compile, test, dev server), ' +
      'use start_process instead — it returns a jobId you can poll without re-issuing the command.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to run.',
        },
      },
      required: ['command'],
    },
  };

  public static cleanup(): void {
    for (const child of runningProcesses) {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
    }
    runningProcesses.clear();
    // Also kill any lingering background jobs
    for (const [, job] of JOB_REGISTRY) {
      if (job.running) {
        try { job.child.kill('SIGTERM'); } catch { /* ignore */ }
      }
    }
    JOB_REGISTRY.clear();
  }

  async execute(args: { command: string }): Promise<string> {
    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let resolved = false;

      const child = exec(args.command);
      runningProcesses.add(child);

      const resolveEarly = (msg: string) => {
        if (!resolved) {
          resolved = true;
          resolve(msg);
        }
      };

      child.stdout?.on('data', (data) => {
        stdoutData += data.toString();
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

      child.stderr?.on('data', (data) => { stderrData += data.toString(); });

      child.on('close', (code) => {
        runningProcesses.delete(child);
        let output = stdoutData + stderrData;
        if (code !== 0 && code !== null) output += `\nProcess exited with code ${code}`;
        resolveEarly(output || 'Command completed successfully with no output.');
      });

      child.on('error', (err) => {
        runningProcesses.delete(child);
        resolveEarly(`Process error: ${err.message}\nOutput:\n${stdoutData + stderrData}`);
      });

      // Dynamic timeout: long for install/build, short otherwise
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
          resolveEarly(
            `[Process is running in background] Output so far:\n${stdoutData + stderrData}\n` +
            `Tip: use start_process for long-running commands to get a jobId you can poll.`
          );
        }
      }, timeoutMs);
    });
  }
}
