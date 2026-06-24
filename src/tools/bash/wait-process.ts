import { Tool } from '../types.js';
import { JOB_REGISTRY } from './state.js';

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
