import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlanningManager } from '../../src/planning/planner.js';
import fs from 'fs';
import path from 'path';
describe('PlanningManager', () => {
    const testRoot = path.resolve('test_planning_temp');
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
    const mockFetch = vi.fn();
    beforeEach(() => {
        global.fetch = mockFetch;
        if (fs.existsSync(testRoot)) {
            fs.rmSync(testRoot, { recursive: true, force: true });
        }
    });
    afterEach(() => {
        vi.restoreAllMocks();
        if (fs.existsSync(testRoot)) {
            fs.rmSync(testRoot, { recursive: true, force: true });
        }
    });
    it('should draft and critique plans using model aliases', async () => {
        // Mock draft fetch response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Draft outline text' } }],
                usage: { prompt_tokens: 10, completion_tokens: 20 },
            }),
        });
        // Mock critique fetch response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Final revised plan text' } }],
                usage: { prompt_tokens: 15, completion_tokens: 25 },
            }),
        });
        const planner = new PlanningManager(dummyConfig, testRoot);
        const draft = await planner.draftPlan('implement tests');
        expect(draft).toBe('Draft outline text');
        const finalPlan = await planner.critiqueAndRewrite(draft);
        expect(finalPlan).toBe('Final revised plan text');
    });
    it('should save, list, and archive plans successfully', async () => {
        const planner = new PlanningManager(dummyConfig, testRoot);
        // Initial list should be empty
        let list = await planner.listPlans();
        expect(list.active).toEqual([]);
        expect(list.archived).toEqual([]);
        // Save a plan
        await planner.savePlan('plan_abc', 'plan contents');
        list = await planner.listPlans();
        expect(list.active).toEqual(['plan_abc']);
        expect(list.archived).toEqual([]);
        // Archive the plan
        const archived = await planner.archivePlan('plan_abc');
        expect(archived).toBe(true);
        list = await planner.listPlans();
        expect(list.active).toEqual([]);
        expect(list.archived).toEqual(['plan_abc']);
        // Check files actually moved
        const activeFile = path.join(testRoot, '.agent', 'plans', 'plan_abc.md');
        const archivedFile = path.join(testRoot, '.agent', 'plans', 'archived', 'plan_abc.md');
        expect(fs.existsSync(activeFile)).toBe(false);
        expect(fs.existsSync(archivedFile)).toBe(true);
    });
});
