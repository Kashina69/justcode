export const MAX_MEMORY_RECALL_TOKENS = 4000;
export const PRICING_RATES = {
    sonnet: { inputRate: 3.0, cacheHitRate: 0.3, outputRate: 15.0 },
    haiku: { inputRate: 0.8, cacheHitRate: 0.08, outputRate: 4.0 },
    'deepseek-chat': { inputRate: 0.14, cacheHitRate: 0.055, outputRate: 0.28 },
    'deepseek-v3': { inputRate: 0.14, cacheHitRate: 0.055, outputRate: 0.28 },
    'deepseek-coder': { inputRate: 0.55, cacheHitRate: 0.14, outputRate: 2.19 },
    'deepseek-reasoner': { inputRate: 0.55, cacheHitRate: 0.14, outputRate: 2.19 },
    'deepseek-r1': { inputRate: 0.55, cacheHitRate: 0.14, outputRate: 2.19 },
    r1: { inputRate: 0.55, cacheHitRate: 0.14, outputRate: 2.19 },
    'gpt-4o-mini': { inputRate: 0.15, cacheHitRate: 0.15, outputRate: 0.6 },
    'gpt-4o': { inputRate: 5.0, cacheHitRate: 5.0, outputRate: 15.0 },
    default: { inputRate: 2.0, cacheHitRate: 0.2, outputRate: 10.0 }
};
/**
 * Resolves the pricing rates for a given model ID.
 * Falls back to the default rate if model ID is unrecognized.
 */
export function getPricingRates(modelId) {
    const modelLower = modelId.toLowerCase();
    for (const key of Object.keys(PRICING_RATES)) {
        if (key !== 'default' && modelLower.includes(key)) {
            return PRICING_RATES[key];
        }
    }
    return PRICING_RATES.default;
}
// Global configuration defaults
export const DEFAULT_MODEL_FAST = 'claude-3-5-haiku-20241022';
export const DEFAULT_MODEL_SMART = 'claude-3-5-sonnet-20241022';
export const DEFAULT_MODEL_PLANNER = 'claude-3-5-sonnet-20241022';
export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';
export const PROVIDER_PROFILES = {
    'Anthropic': {
        name: 'anthropic',
        type: 'anthropic',
        endpoint: 'https://api.anthropic.com',
        modelAliases: {
            fast: 'claude-3-5-haiku-20241022',
            smart: 'claude-3-5-sonnet-20241022',
            planner: 'claude-3-5-sonnet-20241022',
        }
    },
    'OpenAI': {
        name: 'openai',
        type: 'openai-compat',
        endpoint: 'https://api.openai.com/v1',
        modelAliases: {
            fast: 'gpt-4o-mini',
            smart: 'gpt-4o',
            planner: 'gpt-4o',
        }
    },
    'DeepSeek': {
        name: 'deepseek',
        type: 'openai-compat',
        endpoint: 'https://api.deepseek.com',
        modelAliases: {
            fast: 'deepseek-chat',
            smart: 'deepseek-coder',
            planner: 'deepseek-coder',
        }
    },
    'OpenRouter': {
        name: 'openrouter',
        type: 'openai-compat',
        endpoint: 'https://openrouter.ai/api/v1',
        modelAliases: {
            fast: 'google/gemini-flash-1.5',
            smart: 'anthropic/claude-3.5-sonnet',
            planner: 'anthropic/claude-3.5-sonnet',
        }
    },
    'Google Gemini': {
        name: 'google-gemini',
        type: 'openai-compat',
        endpoint: 'https://generativelabs.google',
        modelAliases: {
            fast: 'gemini-1.5-flash',
            smart: 'gemini-1.5-pro',
            planner: 'gemini-1.5-pro',
        }
    }
};
// Fallbacks for providers API
export const FALLBACK_MODEL_OPENAI = 'gpt-4o-mini';
export const FALLBACK_MODEL_ANTHROPIC = 'claude-3-5-sonnet-20241022';
// Token limits and defaults for models
export const DEFAULT_MAX_TOKENS = 4000;
export const THINKING_MODEL_BUDGET_TOKENS = 2000;
export const THINKING_MODEL_MAX_TOKENS = 8000;
// Path components
export const AGENT_DIR_NAME = '.agent';
export const USAGE_LOG_FILENAME = 'usage.log';
export const CONFIG_JSON_FILENAME = 'config.json';
