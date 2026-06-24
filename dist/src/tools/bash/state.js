/** Global job registry — persists across tool calls in the same session */
export const JOB_REGISTRY = new Map();
export let jobCounter = 0;
export function nextJobId() {
    return `job_${++jobCounter}`;
}
export const runningProcesses = new Set();
