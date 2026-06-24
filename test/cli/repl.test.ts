import { describe, it, expect, vi } from 'vitest';
import { processUserPrompt } from '../../src/cli/repl.js';
import { CliContext } from '../../src/cli/context.js';
import fs from 'fs';
import path from 'path';

describe('processUserPrompt', () => {
  it('should pin a skill when prompt contains @skillname', async () => {
    const mockContext = {
      skillNames: ['ponytail', 'caveman'],
      pinnedSkills: new Set<string>(),
      mutedSkills: new Set<string>(),
    } as unknown as CliContext;

    const result = await processUserPrompt(mockContext, 'use @ponytail to build code');
    expect(result).toBe('use @ponytail to build code');
    expect(mockContext.pinnedSkills.has('ponytail')).toBe(true);
    expect(mockContext.mutedSkills.has('ponytail')).toBe(false);
  });

  it('should mute a skill when prompt contains !@skillname', async () => {
    const mockContext = {
      skillNames: ['ponytail', 'caveman'],
      pinnedSkills: new Set<string>(['ponytail']),
      mutedSkills: new Set<string>(),
    } as unknown as CliContext;

    const result = await processUserPrompt(mockContext, 'dont use !@ponytail thanks');
    expect(result).toBe('dont use !@ponytail thanks');
    expect(mockContext.pinnedSkills.has('ponytail')).toBe(false);
    expect(mockContext.mutedSkills.has('ponytail')).toBe(true);
  });

  it('should inject file content when prompt contains @filepath', async () => {
    const mockContext = {
      skillNames: ['ponytail'],
      pinnedSkills: new Set<string>(),
      mutedSkills: new Set<string>(),
    } as unknown as CliContext;

    // Create a temporary file to read
    const tempFile = path.join(process.cwd(), 'temp_test_context.txt');
    fs.writeFileSync(tempFile, 'line1\nline2\nline3', 'utf-8');

    try {
      const result = await processUserPrompt(mockContext, 'analyze @temp_test_context.txt please');
      expect(result).toContain('analyze @temp_test_context.txt please');
      expect(result).toContain('[Injected File Contexts]');
      expect(result).toContain('### File Context: temp_test_context.txt');
      expect(result).toContain('line1\nline2\nline3');
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('should inject specific line range when prompt contains @filepath:start-end', async () => {
    const mockContext = {
      skillNames: [],
      pinnedSkills: new Set<string>(),
      mutedSkills: new Set<string>(),
    } as unknown as CliContext;

    const tempFile = path.join(process.cwd(), 'temp_test_lines.txt');
    fs.writeFileSync(tempFile, 'one\ntwo\nthree\nfour\nfive', 'utf-8');

    try {
      const result = await processUserPrompt(mockContext, 'look at @temp_test_lines.txt:2-4');
      expect(result).toContain('look at @temp_test_lines.txt:2-4');
      expect(result).toContain('### File Context: temp_test_lines.txt (lines 2-4)');
      expect(result).toContain('two\nthree\nfour');
      expect(result).not.toContain('one');
      expect(result).not.toContain('five');
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });
});
