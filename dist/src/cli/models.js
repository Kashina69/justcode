import { loadAppConfig, writeAppConfig } from '../config/index.js';
import { selectOption } from './select-option.js';
import { ALIAS_OPTIONS, FALLBACK_ANTHROPIC_MODELS, FALLBACK_OPENAI_MODELS, MODEL_DESCRIPTIONS } from './constants.js';
/**
 * Returns a brief human-readable description for common model IDs.
 */
export const getModelInfo = (modelId) => {
    const lower = modelId.toLowerCase();
    for (const [key, desc] of Object.entries(MODEL_DESCRIPTIONS)) {
        if (lower.includes(key)) {
            return desc;
        }
    }
    return 'General purpose model';
};
/**
 * Queries the provider's /models endpoint dynamically.
 */
export const fetchModelsForProvider = async (providerType, apiKey, endpoint) => {
    if (providerType === 'anthropic') {
        return FALLBACK_ANTHROPIC_MODELS;
    }
    const cleanUrl = (endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const targetUrl = `${cleanUrl}/models`;
    try {
        const headers = {};
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const res = await fetch(targetUrl, { headers });
        if (res.ok) {
            const json = (await res.json());
            if (json.data && Array.isArray(json.data)) {
                return json.data.map((m) => ({
                    id: m.id,
                }));
            }
        }
    }
    catch {
        // Ignore
    }
    return FALLBACK_OPENAI_MODELS;
};
/**
 * Interactive menu to map model aliases to active provider profiles.
 */
export const handleModelsMenu = async () => {
    const aliasIndex = await selectOption('Select model alias to update:', ALIAS_OPTIONS);
    if (aliasIndex === ALIAS_OPTIONS.length - 1) {
        return;
    }
    const selectedAlias = ALIAS_OPTIONS[aliasIndex];
    let cfg = loadAppConfig();
    const providersList = Object.keys(cfg.providers || {});
    if (!providersList.includes('anthropic'))
        providersList.push('anthropic');
    if (!providersList.includes('openai-compat'))
        providersList.push('openai-compat');
    providersList.push('[Cancel]');
    const providerIndex = await selectOption('Select provider for this alias:', providersList);
    if (providerIndex === providersList.length - 1) {
        return;
    }
    const selectedProvider = providersList[providerIndex];
    let providerType = selectedProvider === 'anthropic' ? 'anthropic' : 'openai-compat';
    let apiKey = selectedProvider === 'anthropic' ? cfg.anthropicApiKey || '' : cfg.openaiApiKey || '';
    let endpoint = selectedProvider === 'anthropic' ? cfg.anthropicEndpoint : cfg.openaiEndpoint;
    if (cfg.providers && cfg.providers[selectedProvider]) {
        providerType = cfg.providers[selectedProvider].type;
        apiKey = cfg.providers[selectedProvider].apiKey;
        endpoint = cfg.providers[selectedProvider].endpoint;
    }
    console.log(`\n⏳ Fetching available models for provider "${selectedProvider}"...`);
    const fetchedModels = await fetchModelsForProvider(providerType, apiKey, endpoint);
    const modelOptions = fetchedModels.map(m => `${m.id} — ${getModelInfo(m.id)}`);
    modelOptions.push('[Cancel]');
    const modelIndex = await selectOption('Select model from list:', modelOptions);
    if (modelIndex === modelOptions.length - 1) {
        return;
    }
    const selectedModel = fetchedModels[modelIndex].id;
    const currentAliases = { ...cfg.modelAliases };
    currentAliases[selectedAlias] = { provider: selectedProvider, modelId: selectedModel };
    writeAppConfig({ modelAliases: currentAliases });
    console.log(`\n✅ Alias "${selectedAlias}" successfully mapped to provider "${selectedProvider}" using model "${selectedModel}".\n`);
};
