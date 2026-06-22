import { describe, it, expect, vi, afterEach } from 'vitest';
import { SkillMatcher } from '../../src/skills/matcher.js';
import fs from 'fs/promises';
describe('SkillMatcher', () => {
    const dummyConfig = {
        anthropicApiKey: undefined,
        openaiApiKey: 'dummy-openai-key',
        openaiEndpoint: 'https://api.openai.com/v1',
        modelAliases: {
            fast: { provider: 'openai-compat', modelId: 'gpt-4o-mini' },
            smart: { provider: 'openai-compat', modelId: 'gpt-4o' },
            planner: { provider: 'openai-compat', modelId: 'gpt-4-turbo' },
        },
    };
    const dummySkills = [
        { name: 'coding-efficiency', description: 'always active', content: 'efficient' },
        { name: 'nextjs-conventions', description: 'next conventions', content: 'next-rules' },
        { name: 'other-skill', description: 'other behavior', content: 'other-rules' },
    ];
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('should always match coding-efficiency if present', async () => {
        vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
        const matcher = new SkillMatcher(dummyConfig);
        const matched = await matcher.matchSkills('Just clean my code', dummySkills);
        expect(matched).toHaveLength(1);
        expect(matched[0].name).toBe('coding-efficiency');
    });
    it('should match nextjs-conventions if next dependency is in package.json', async () => {
        vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
            dependencies: {
                next: '^14.0.0',
            },
        }));
        const matcher = new SkillMatcher(dummyConfig);
        const matched = await matcher.matchSkills('Deploy the server', dummySkills);
        expect(matched).toHaveLength(2);
        expect(matched.map(s => s.name)).toContain('coding-efficiency');
        expect(matched.map(s => s.name)).toContain('nextjs-conventions');
    });
    it('should match other skills via keyword in task description', async () => {
        vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
        const matcher = new SkillMatcher(dummyConfig);
        const matched = await matcher.matchSkills('Use other-skill please', dummySkills);
        expect(matched).toHaveLength(2);
        expect(matched.map(s => s.name)).toContain('coding-efficiency');
        expect(matched.map(s => s.name)).toContain('other-skill');
    });
});
