import { describe, it, expect } from 'vitest';
import { GrepTool } from '../../src/tools/grep.js';
import { GlobTool } from '../../src/tools/glob.js';
import { BashTool } from '../../src/tools/bash/index.js';

describe('Search & Exec Tools', () => {
  it('should find text in package.json using GrepTool', async () => {
    const tool = new GrepTool();
    const result = await tool.execute({ pattern: 'justcode' });
    expect(result).toContain('package.json:');
  });

  it('should find files using GlobTool', async () => {
    const tool = new GlobTool();
    const result = await tool.execute({ pattern: 'src/tools/*.ts' });
    expect(result).toContain('src/tools/read_file.ts');
  });

  it('should run a command using BashTool', async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: 'echo hello' });
    expect(result.trim()).toBe('hello');
  });
});
