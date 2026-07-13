import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditFileTool } from '../../src/tools/edit_file.js';
import fs from 'fs/promises';
import path from 'path';

describe('EditFileTool', () => {
  const testFile = path.resolve('test_edit_temp.txt');
  const tool = new EditFileTool();

  beforeEach(async () => {
    const content = 'line 1\nline 2\nline 3\nline 2\nline 5';
    await fs.writeFile(testFile, content, 'utf-8');
  });

  afterEach(async () => {
    await fs.unlink(testFile).catch(() => {});
  });

  it('should successfully replace unique text block', async () => {
    const result = await tool.execute({
      path: testFile,
      edits: [
        {
          oldText: 'line 3',
          newText: 'line 3 modified',
        },
      ],
    });

    expect(result).toContain('Successfully applied 1 edits');
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('line 1\nline 2\nline 3 modified\nline 2\nline 5');
  });

  it('should return error if oldText is not unique', async () => {
    const result = await tool.execute({
      path: testFile,
      edits: [
        {
          oldText: 'line 2',
          newText: 'line 2 modified',
        },
      ],
    });

    expect(result).toContain('Error at edit block #1: The target text (oldText) is not unique');
  });

  it('should return error if oldText is not found', async () => {
    const result = await tool.execute({
      path: testFile,
      edits: [
        {
          oldText: 'nonexistent line',
          newText: 'line modified',
        },
      ],
    });

    expect(result).toContain('Error at edit block #1: The target text (oldText) was not found');
  });
});
