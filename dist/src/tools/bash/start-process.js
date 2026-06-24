import { exec } from 'child_process';
import { JOB_REGISTRY, nextJobId } from './state.js';
export class StartProcessTool {
    definition = {
        name: 'start_process',
        description: 'Starts a command as a tracked background process and returns a jobId immediately. ' +
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
    async execute(args) {
        const jobId = nextJobId();
        const job = {
            child: null,
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
