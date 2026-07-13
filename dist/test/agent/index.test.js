import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator } from '../../src/agent/index.js';
import { ToolRegistry } from '../../src/tools/registry.js';
import { SafetyGate } from '../../src/safety/gate.js';
import { BackupManager } from '../../src/safety/backup.js';
describe('AgentOrchestrator Model Routing', () => {
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
    const registry = new ToolRegistry();
    const safetyGate = new SafetyGate();
    const backupManager = new BackupManager();
    const mockConfirm = vi.fn();
    const orchestrator = new AgentOrchestrator({
        config: dummyConfig,
        registry,
        safetyGate,
        backupManager,
        onConfirmDangerousTool: mockConfirm,
        systemPrompt: 'You are an agent.'
    });
    it('should route to planner for plan commands and planning keywords', () => {
        expect(orchestrator.routeModelAlias([{ role: 'user', content: '/plan a new feature' }], false)).toBe('planner');
        expect(orchestrator.routeModelAlias([{ role: 'user', content: 'please draft a plan for the server' }], false)).toBe('planner');
    });
    it('should route to fast for execution when active plans are present', () => {
        expect(orchestrator.routeModelAlias([{ role: 'user', content: 'implement tests for the database' }], true)).toBe('fast');
    });
    it('should route to smart even with active plans if complex logic/refactoring is asked', () => {
        expect(orchestrator.routeModelAlias([{ role: 'user', content: 'please refactor and optimize performance of index.ts' }], true)).toBe('smart');
    });
    it('should route to fast for conversational/short queries', () => {
        expect(orchestrator.routeModelAlias([{ role: 'user', content: 'hello' }], false)).toBe('fast');
        expect(orchestrator.routeModelAlias([{ role: 'user', content: 'what is the current status?' }], false)).toBe('fast');
    });
    it('should route to smart for general code changes without active plans', () => {
        expect(orchestrator.routeModelAlias([{ role: 'user', content: 'add a new endpoint to handle backups' }], false)).toBe('smart');
    });
});
