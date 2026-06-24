import readline from 'readline';
import { loadAppConfig, writeAppConfig, getGlobalConfigPath, AppConfig } from '../config/index.js';
import { selectOption } from './select-option.js';
import { askQuestion } from './ask-question.js';
import { PROVIDER_OPTIONS } from './constants.js';
import { PROVIDER_PROFILES } from '../config/constants.js';

/**
 * Runs the interactive API provider onboarding flow.
 *
 * @param rl Readline interface for query input.
 * @returns Promise resolving to the newly loaded configuration.
 */
export async function runOnboarding(rl: readline.Interface): Promise<AppConfig> {
  console.log('\n======================================================');
  console.log('🤖 Welcome to justcode! Let\'s set up your API keys.');
  console.log(`Your configuration will be saved to: ${getGlobalConfigPath()}`);
  console.log('======================================================\n');

  const choiceIndex = await selectOption('Select API Provider:', PROVIDER_OPTIONS);
  const selectedProvider = PROVIDER_OPTIONS[choiceIndex];

  let providerName = '';
  let providerType: 'anthropic' | 'openai-compat' = 'openai-compat';
  let endpoint = '';
  let apiKey = '';

  if (selectedProvider === 'Custom Provider') {
    providerName = await askQuestion(rl, 'Enter Provider Name (e.g. together, local): ');
    providerName = providerName.toLowerCase().trim();
    
    const typeChoice = await selectOption('Select Provider Type:', ['OpenAI-compatible', 'Anthropic']);
    providerType = typeChoice === 0 ? 'openai-compat' : 'anthropic';
    
    apiKey = await askQuestion(rl, 'Enter your API Key: ');
    endpoint = await askQuestion(rl, 'Enter the API Endpoint URL (e.g. http://localhost:11434/v1): ');
  } else {
    apiKey = await askQuestion(rl, `Enter your ${selectedProvider} API Key: `);
    const profile = PROVIDER_PROFILES[selectedProvider];
    if (profile) {
      providerName = profile.name;
      providerType = profile.type;
      endpoint = profile.endpoint;
    }
  }

  let modelAliases = {
    fast: { provider: providerName, modelId: 'gpt-4o-mini' },
    smart: { provider: providerName, modelId: 'gpt-4o' },
    planner: { provider: providerName, modelId: 'gpt-4o' }
  };

  const foundProfile = Object.values(PROVIDER_PROFILES).find(p => p.name === providerName);
  if (foundProfile) {
    modelAliases = {
      fast: { provider: providerName, modelId: foundProfile.modelAliases.fast },
      smart: { provider: providerName, modelId: foundProfile.modelAliases.smart },
      planner: { provider: providerName, modelId: foundProfile.modelAliases.planner }
    };
  }

  const currentConfig = loadAppConfig();
  const updatedProviders = {
    ...(currentConfig.providers || {}),
    [providerName]: {
      type: providerType,
      apiKey,
      endpoint: endpoint || undefined
    }
  };

  const updateData: Partial<AppConfig> = {
    providers: updatedProviders,
    modelAliases
  };

  if (providerType === 'anthropic') {
    updateData.anthropicApiKey = apiKey;
    if (endpoint) updateData.anthropicEndpoint = endpoint;
  } else {
    updateData.openaiApiKey = apiKey;
    if (endpoint) updateData.openaiEndpoint = endpoint;
  }

  writeAppConfig(updateData);

  console.log('\n✅ Configuration saved successfully!\n');
  return loadAppConfig();
}
