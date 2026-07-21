import readline from 'readline';
import { loadAppConfig, AppConfig } from '../config/index.js';
import { needsOnboarding, validateProviderConfig } from './validate.js';
import { runInteractiveSetup } from './interactive.js';

export { needsOnboarding, validateProviderConfig } from './validate.js';

export async function ensureAppConfigured(): Promise<AppConfig> {
  let config = loadAppConfig();

  if (needsOnboarding(config)) {
    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    config = await runInteractiveSetup(tempRl);
    tempRl.close();
  }

  const validation = validateProviderConfig(config);
  if (!validation.valid) {
    console.error(validation.error);
    process.exit(1);
  }

  return config;
}
