import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkillMatcher } from '../../src/skills/matcher.js';
import { AppConfig } from '../../src/config/index.js';
import { Skill } from '../../src/skills/types.js';

describe('SkillMatcher', () => {
  const dummyConfig: AppConfig = {
    anthropicApiKey: undefined,
    openaiApiKey: 'dummy-openai-key',
    openaiEndpoint: 'https://api.openai.com/v1',
    modelAliases: {
      fast: { provider: 'openai-compat', modelId: 'gpt-4o-mini' },
      smart: { provider: 'openai-compat', modelId: 'gpt-4o' },
      planner: { provider: 'openai-compat', modelId: 'gpt-4-turbo' },
    },
  };

  const dummySkills: Skill[] = [
    { name: 'caveman', description: 'terse output style', content: 'terse' },
    { name: 'ponytail', description: 'walk decision ladder before writing code', content: 'ladder' },
  ];

  const mockFetch = vi.fn();
  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should match skills successfully using the fast model provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '["caveman"]',
            },
          },
        ],
      }),
    });

    const matcher = new SkillMatcher(dummyConfig);
    const matched = await matcher.matchSkills('Make explanations very short and concise', dummySkills);

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('caveman');
  });

  it('should fall back to keyword matching if provider throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const matcher = new SkillMatcher(dummyConfig);
    const matched = await matcher.matchSkills('I want caveman style output', dummySkills);

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('caveman');
  });
});
