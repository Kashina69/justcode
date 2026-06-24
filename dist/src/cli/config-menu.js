import { loadAppConfig, writeAppConfig } from '../config/index.js';
import { selectOption } from './select-option.js';
import { askQuestion } from './ask-question.js';
import { handleModelsMenu } from './models.js';
import { CONFIG_MENU_OPTIONS } from './constants.js';
/**
 * Renders the interactive configuration management loop.
 *
 * @param rl Readline interface for text prompts.
 * @param resumePrompt Callback to resume prompt input loop.
 */
export const handleConfigMenu = async (rl, resumePrompt) => {
    while (true) {
        const choice = await selectOption('\nInteractive Config Editor:', CONFIG_MENU_OPTIONS);
        if (choice === CONFIG_MENU_OPTIONS.length - 1) {
            break;
        }
        let cfg = loadAppConfig();
        if (choice === 0) {
            const name = await askQuestion(rl, 'Enter new Provider Name (e.g. together): ');
            const trimmedName = name.toLowerCase().trim();
            if (!trimmedName)
                continue;
            const typeChoice = await selectOption('Select Provider Type:', ['OpenAI-compatible', 'Anthropic']);
            const type = typeChoice === 0 ? 'openai-compat' : 'anthropic';
            const apiKey = await askQuestion(rl, 'Enter API Key: ');
            const endpoint = await askQuestion(rl, 'Enter Endpoint URL: ');
            const updatedProviders = {
                ...(cfg.providers || {}),
                [trimmedName]: {
                    type,
                    apiKey,
                    endpoint: endpoint || undefined
                }
            };
            writeAppConfig({ providers: updatedProviders });
            console.log(`\n✅ Provider "${trimmedName}" successfully configured.\n`);
        }
        else if (choice === 1) {
            const providers = Object.keys(cfg.providers || {});
            if (providers.length === 0) {
                console.log('\n⚠️  No custom providers currently configured.');
                continue;
            }
            providers.push('[Cancel]');
            const idx = await selectOption('Select provider to edit:', providers);
            if (idx === providers.length - 1)
                continue;
            const providerToEdit = providers[idx];
            const providerConfig = cfg.providers[providerToEdit];
            console.log(`\nEditing Provider "${providerToEdit}" (press Enter to keep existing value):`);
            const newKey = await askQuestion(rl, `Enter new API Key (current: ${providerConfig.apiKey.substring(0, 8)}...): `);
            const newEndpoint = await askQuestion(rl, `Enter new Endpoint URL (current: ${providerConfig.endpoint || 'none'}): `);
            const updatedProviders = {
                ...(cfg.providers || {}),
                [providerToEdit]: {
                    ...providerConfig,
                    apiKey: newKey || providerConfig.apiKey,
                    endpoint: newEndpoint || providerConfig.endpoint
                }
            };
            writeAppConfig({ providers: updatedProviders });
            console.log(`\n✅ Provider "${providerToEdit}" successfully updated.\n`);
        }
        else if (choice === 2) {
            await handleModelsMenu();
        }
        else if (choice === 3) {
            console.log('\n================ CONFIG SUMMARY ================');
            console.log('Model Aliases:');
            console.log(`  fast:    provider="${cfg.modelAliases.fast.provider}" modelId="${cfg.modelAliases.fast.modelId}"`);
            console.log(`  smart:   provider="${cfg.modelAliases.smart.provider}" modelId="${cfg.modelAliases.smart.modelId}"`);
            console.log(`  planner: provider="${cfg.modelAliases.planner.provider}" modelId="${cfg.modelAliases.planner.modelId}"`);
            const customProviders = Object.keys(cfg.providers || {});
            console.log('\nConfigured Providers:');
            if (customProviders.length === 0) {
                console.log('  (none)');
            }
            else {
                for (const name of customProviders) {
                    const p = cfg.providers[name];
                    console.log(`  - ${name}: type=${p.type} endpoint=${p.endpoint || 'default'} key=${p.apiKey.substring(0, 8)}...`);
                }
            }
            console.log('================================================\n');
        }
    }
    resumePrompt();
};
