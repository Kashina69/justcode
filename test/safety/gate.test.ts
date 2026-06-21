import { describe, it, expect } from 'vitest';
import { SafetyGate } from '../../src/safety/gate.js';

describe('SafetyGate', () => {
  const gate = new SafetyGate(process.cwd());

  it('should classify read_file inside root as safe', () => {
    const result = gate.classifyToolCall('read_file', { path: 'package.json' });
    expect(result.classification).toBe('safe');
  });

  it('should classify read_file outside root as dangerous', () => {
    const result = gate.classifyToolCall('read_file', { path: '../../package.json' });
    expect(result.classification).toBe('dangerous');
    expect(result.reason).toContain('resolves outside the project root');
  });

  it('should classify write_file as write', () => {
    const result = gate.classifyToolCall('write_file', { path: 'src/dummy.ts', content: 'test' });
    expect(result.classification).toBe('write');
  });

  it('should classify any bash command as dangerous', () => {
    const result = gate.classifyToolCall('bash', { command: 'ls' });
    expect(result.classification).toBe('dangerous');
    expect(result.reason).toContain('executions require manual confirmation');
  });

  it('should catch denylist matches in bash commands', () => {
    const result = gate.classifyToolCall('bash', { command: 'rm -rf src/' });
    expect(result.classification).toBe('dangerous');
    expect(result.reason).toContain('matches denylist pattern');
  });
});
