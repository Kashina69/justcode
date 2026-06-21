import { describe, it, expect, afterAll } from 'vitest';
import { BashTool } from '../../src/tools/bash.js';

describe('BashTool', () => {
  afterAll(() => {
    BashTool.cleanup();
  });

  it('should execute a simple command successfully', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: 'echo hello_world' });
    expect(result.trim()).toContain('hello_world');
  });

  it('should resolve early if server startup patterns are parsed', async () => {
    const tool = new BashTool();
    const startTime = Date.now();
    const result = await tool.execute({
      command: 'node -e "console.log(\'listening on port 3000\'); setTimeout(() => {}, 10000);"'
    });
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(3000);
    expect(result).toContain('[Process started in background]');
    expect(result).toContain('listening on port 3000');
    expect(BashTool.runningProcesses.size).toBeGreaterThan(0);
  });

  it('should terminate background processes on cleanup', async () => {
    expect(BashTool.runningProcesses.size).toBeGreaterThan(0);
    BashTool.cleanup();
    expect(BashTool.runningProcesses.size).toBe(0);
  });
});
