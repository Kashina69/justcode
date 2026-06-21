import { exec, ChildProcess } from 'child_process';
import { Tool } from './types.js';

/** Stored state for a tracked background job */
interface BackgroundJob {
  child: ChildProcess;
  running: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  lastCheckedOffset: number; // byte offset for "new output since last check"
}

/** Global job registry — persists across tool calls in the same session */
const JOB_REGISTRY = new Map<string, BackgroundJob>();

let jobCounter = 0;
function nextJobId(): string {
  return `job_${++jobCounter}`;
}

// ─── BashTool (synchronous / short-lived commands) ───────────────────────────

export class BashTool implements Tool {
  public static runningProcesses = new Set<ChildProcess>();

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
    for (const child of BashTool.runningProcesses) {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
    }
    BashTool.runningProcesses.clear();
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
      BashTool.runningProcesses.add(child);

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
        BashTool.runningProcesses.delete(child);
        let output = stdoutData + stderrData;
        if (code !== 0 && code !== null) output += `\nProcess exited with code ${code}`;
        resolveEarly(output || 'Command completed successfully with no output.');
      });

      child.on('error', (err) => {
        BashTool.runningProcesses.delete(child);
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

// ─── StartProcessTool ─────────────────────────────────────────────────────────

export class StartProcessTool implements Tool {
  definition = {
    name: 'start_process',
    description:
      'Starts a command as a tracked background process and returns a jobId immediately. ' +
      'Use this for npm install, npm run build, npx next build, test runs, dev servers — ' +
      'any command expected to take more than a few seconds. ' +
      'After starting, call check_process or wait_process with the returned jobId to poll its status. ' +
      'NEVER re-issue start_process for the same logical operation to check if it finished — use wait_process.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to start in the background.',
        },
      },
      required: ['command'],
    },
  };

  async execute(args: { command: string }): Promise<string> {
    const jobId = nextJobId();
    const job: BackgroundJob = {
      child: null as any,
      running: true,
      exitCode: null,
      stdout: '',
      stderr: '',
      lastCheckedOffset: 0,
    };

    const child = exec(args.command);
    job.child = child;
    JOB_REGISTRY.set(jobId, job);

    child.stdout?.on('data', (data) => { job.stdout += data.toString(); });
    child.stderr?.on('data', (data) => { job.stderr += data.toString(); });
    child.on('close', (code) => {
      job.running = false;
      job.exitCode = code;
    });
    child.on('error', (err) => {
      job.running = false;
      job.exitCode = -1;
      job.stderr += `\nProcess error: ${err.message}`;
    });

    return JSON.stringify({ jobId, message: `Process started. Poll with check_process("${jobId}") or wait_process("${jobId}", timeoutMs).` });
  }
}

// ─── CheckProcessTool ─────────────────────────────────────────────────────────

export class CheckProcessTool implements Tool {
  definition = {
    name: 'check_process',
    description:
      'Returns the current status of a background process started with start_process. ' +
      'Returns running state, exit code (if finished), and any new output since the last check.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'The jobId returned by start_process.',
        },
      },
      required: ['jobId'],
    },
  };

  async execute(args: { jobId: string }): Promise<string> {
    const job = JOB_REGISTRY.get(args.jobId);
    if (!job) {
      return JSON.stringify({ error: `No job found with id "${args.jobId}". Was it started with start_process?` });
    }

    const combined = job.stdout + job.stderr;
    const newOutput = combined.slice(job.lastCheckedOffset);
    job.lastCheckedOffset = combined.length;

    return JSON.stringify({
      jobId: args.jobId,
      running: job.running,
      exitCode: job.exitCode,
      newOutputSinceLastCheck: newOutput || '(no new output)',
      totalOutputLength: combined.length,
    });
  }
}

// ─── WaitProcessTool ──────────────────────────────────────────────────────────

export class WaitProcessTool implements Tool {
  definition = {
    name: 'wait_process',
    description:
      'Polls a background process until it completes or the timeout is reached. ' +
      'Use this instead of re-issuing the original command when waiting for npm install, builds, or tests. ' +
      'Returns the exit code, completion status, and full output on completion.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'The jobId returned by start_process.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Maximum milliseconds to wait before returning (default: 15000). Use 60000+ for npm install or builds.',
        },
      },
      required: ['jobId'],
    },
  };

  async execute(args: { jobId: string; timeoutMs?: number }): Promise<string> {
    const job = JOB_REGISTRY.get(args.jobId);
    if (!job) {
      return JSON.stringify({ error: `No job found with id "${args.jobId}".` });
    }

    const timeoutMs = args.timeoutMs ?? 15000;
    const pollIntervalMs = 500;
    const deadline = Date.now() + timeoutMs;

    while (job.running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    const combined = job.stdout + job.stderr;
    const newOutput = combined.slice(job.lastCheckedOffset);
    job.lastCheckedOffset = combined.length;

    return JSON.stringify({
      jobId: args.jobId,
      completed: !job.running,
      exitCode: job.exitCode,
      exitedSuccessfully: job.exitCode === 0,
      newOutputSinceLastCheck: newOutput || '(no new output)',
      fullOutput: combined,
      timedOut: job.running,
    });
  }
}
