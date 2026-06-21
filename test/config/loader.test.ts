import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAppConfig } from '../../src/config/index.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('ConfigLoader', () => {
  const testHome = path.resolve('test_home_temp');

  beforeEach(() => {
    // Mock os.homedir to redirect config checks to test_home_temp
    vi.spyOn(os, 'homedir').mockReturnValue(testHome);
    if (fs.existsSync(testHome)) {
      fs.rmSync(testHome, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testHome)) {
      fs.rmSync(testHome, { recursive: true, force: true });
    }
  });

  it('should fall back to defaults if global config file is missing', () => {
    const config = loadAppConfig();
    expect(config.openaiEndpoint).toBe('https://api.openai.com/v1');
    expect(config.modelAliases.fast.provider).toBe('anthropic');
  });

  it('should load and merge settings from ~/.agent/config.json', () => {
    const configDir = path.join(testHome, '.agent');
    fs.mkdirSync(configDir, { recursive: true });

    const configData = {
      openaiApiKey: 'test-openai-key-value',
      openaiEndpoint: 'https://test-endpoint.com/v1',
      modelAliases: {
        fast: {
          provider: 'openai-compat',
          modelId: 'gpt-4o-mini-test',
        },
      },
    };

    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(configData), 'utf-8');

    const config = loadAppConfig();
    expect(config.openaiApiKey).toBe('test-openai-key-value');
    expect(config.openaiEndpoint).toBe('https://test-endpoint.com/v1');
    expect(config.modelAliases.fast).toEqual({
      provider: 'openai-compat',
      modelId: 'gpt-4o-mini-test',
    });
    // Check fallback for unchanged aliases
    expect(config.modelAliases.smart.provider).toBe('anthropic');
  });
});
