import { ChildProcess } from 'child_process';

/** Stored state for a tracked background job */
export interface BackgroundJob {
  child: ChildProcess;
  running: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  lastCheckedOffset: number; // byte offset for "new output since last check"
}

/** Global job registry — persists across tool calls in the same session */
export const JOB_REGISTRY = new Map<string, BackgroundJob>();

export let jobCounter = 0;

export function nextJobId(): string {
  return `job_${++jobCounter}`;
}

export const runningProcesses = new Set<ChildProcess>();
