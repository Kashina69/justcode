import { describe, it, expect, vi } from 'vitest';
import { AppConfig } from '../../src/config/index.js';
import { ToolRegistry } from '../../src/tools/registry.js';
import { BackupManager } from '../../src/safety/backup.js';

describe('AgentOrchestrator', () => {
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

  it('should create orchestrator with correct config', async () => {
    const { AgentOrchestrator } = await import('../../src/agent/index.js');
    const registry = new ToolRegistry();
    const backupManager = new BackupManager();
    const mockConfirm = vi.fn();

    const orchestrator = new AgentOrchestrator({
      config: dummyConfig,
      registry,
      projectRoot: process.cwd(),
      backupManager,
      onConfirmDangerousTool: mockConfirm,
      systemPrompt: 'You are an agent.',
    });

    expect(orchestrator.config).toBe(dummyConfig);
    expect(orchestrator.projectRoot).toBe(process.cwd());
    expect(orchestrator.registry).toBe(registry);
    expect(orchestrator.backupManager).toBe(backupManager);
  });
});
