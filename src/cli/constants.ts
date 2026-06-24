export const COLLAPSE_THRESHOLD = 15;

export const SLASH_COMMANDS = [
  '/skill', '/debug', '/plan ', '/plans', '/memory',
  '/cost', '/skills', '/undo', '/sessions',
  '/session resume ', '/session list', '/analyze', '/anyalize',
  '/help', '/list', '/config', '/models'
];

export const PROVIDER_OPTIONS = [
  'Anthropic',
  'OpenAI',
  'DeepSeek',
  'OpenRouter',
  'Google Gemini',
  'Custom Provider'
];

export const CONFIG_MENU_OPTIONS = [
  'Add New API Provider',
  'Edit Existing API Provider',
  'Change Model Aliases (/models)',
  'View Config Summary',
  'Exit Config Editor'
];

export const ALIAS_OPTIONS = ['fast', 'smart', 'planner', '[Cancel]'];

export const FALLBACK_ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022' },
  { id: 'claude-3-5-haiku-20241022' },
  { id: 'claude-3-opus-20240229' }
];

export const FALLBACK_OPENAI_MODELS = [
  { id: 'gpt-4o' },
  { id: 'gpt-4o-mini' },
  { id: 'deepseek-chat' },
  { id: 'deepseek-coder' },
  { id: 'gemini-1.5-flash' },
  { id: 'gemini-1.5-pro' }
];

export const MODEL_DESCRIPTIONS: Record<string, string> = {
  'sonnet': 'Claude 3.5 Sonnet (Smart & capable)',
  'haiku': 'Claude 3.5 Haiku (Fast & cheap)',
  'gpt-4o-mini': 'GPT-4o Mini (Fast & cheap)',
  'gpt-4o': 'GPT-4o (Smart & capable)',
  'deepseek-chat': 'DeepSeek Chat (Capable & inexpensive)',
  'deepseek-coder': 'DeepSeek Coder (Code specialist)',
  'gemini-1.5-flash': 'Gemini 1.5 Flash (Fast & cheap)',
  'gemini-1.5-pro': 'Gemini 1.5 Pro (Smart & capable)'
};

