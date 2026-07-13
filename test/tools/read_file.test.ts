import { describe, it, expect } from 'vitest';
import { ReadFileTool } from '../../src/tools/read_file.js';

describe('ReadFileTool', () => {
  it('should read an existing file successfully', async () => {
    const tool = new ReadFileTool();
    const result = await tool.execute({ path: 'package.json' });
    expect(result).toContain('"name": "justcode"');
  });

  it('should return error message if file does not exist', async () => {
    const tool = new ReadFileTool();
    const result = await tool.execute({ path: 'nonexistent_file_xyz.txt' });
    expect(result).toContain('Error reading file at path');
  });
});
