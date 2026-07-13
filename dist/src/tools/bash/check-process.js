import { JOB_REGISTRY } from './state.js';
export class CheckProcessTool {
    definition = {
        name: 'check_process',
        description: 'Returns the current status of a background process started with start_process. ' +
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
    async execute(args) {
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
