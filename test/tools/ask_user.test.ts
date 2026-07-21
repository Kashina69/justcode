import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AskUserTool } from '../../src/tools/ask_user.js';
import readline from 'readline';

vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock the CLI modules
vi.mock('../../src/cli/ask-question.js', () => ({
  askQuestion: vi.fn(),
}));

vi.mock('../../src/cli/select-option.js', () => ({
  selectOption: vi.fn(),
}));

vi.mock('../../src/cli/multi-select.js', () => ({
  multiSelect: vi.fn(),
}));

import { askQuestion } from '../../src/cli/ask-question.js';
import { selectOption } from '../../src/cli/select-option.js';
import { multiSelect } from '../../src/cli/multi-select.js';

describe('AskUserTool', () => {
  let tool: AskUserTool;
  let mockRl: readline.Interface;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new AskUserTool();
    mockRl = {} as readline.Interface;
    tool.setReadline(mockRl);
  });

  it('should prompt free-text question successfully', async () => {
    vi.mocked(askQuestion).mockResolvedValue('User response text');

    const resultStr = await tool.execute({
      questions: [
        {
          prompt: 'What is your name?',
          type: 'text',
        },
      ],
    });

    const result = JSON.parse(resultStr);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]).toEqual({
      prompt: 'What is your name?',
      answer: 'User response text',
    });
    expect(askQuestion).toHaveBeenCalledWith(mockRl, '❓ What is your name? ');
  });

  it('should prompt single-choice question successfully', async () => {
    vi.mocked(selectOption).mockResolvedValue(1); // Selects "Option B"

    const resultStr = await tool.execute({
      questions: [
        {
          prompt: 'Choose one:',
          type: 'single_choice',
          options: ['Option A', 'Option B', 'Option C'],
        },
      ],
    });

    const result = JSON.parse(resultStr);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]).toEqual({
      prompt: 'Choose one:',
      answer: 'Option B',
    });
    expect(selectOption).toHaveBeenCalledWith('❓ Choose one:', ['Option A', 'Option B', 'Option C']);
  });

  it('should prompt multi-choice question successfully', async () => {
    vi.mocked(multiSelect).mockResolvedValue([0, 2]); // Selects "Option A" and "Option C"

    const resultStr = await tool.execute({
      questions: [
        {
          prompt: 'Choose multiple:',
          type: 'multi_choice',
          options: ['Option A', 'Option B', 'Option C'],
        },
      ],
    });

    const result = JSON.parse(resultStr);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]).toEqual({
      prompt: 'Choose multiple:',
      answer: ['Option A', 'Option C'],
    });
    expect(multiSelect).toHaveBeenCalledWith('❓ Choose multiple:', ['Option A', 'Option B', 'Option C']);
  });

  it('should handle missing options gracefully', async () => {
    const resultStr = await tool.execute({
      questions: [
        {
          prompt: 'Missing options single:',
          type: 'single_choice',
        },
        {
          prompt: 'Missing options multi:',
          type: 'multi_choice',
        },
      ],
    });

    const result = JSON.parse(resultStr);
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].error).toBeDefined();
    expect(result.answers[1].error).toBeDefined();
  });
});
