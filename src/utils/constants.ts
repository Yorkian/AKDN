export const PROVIDER_PRESETS = [
  {
    name: 'OpenAI GPT-4o',
    base_url: 'https://api.openai.com/v1',
    api_type: 'openai-completions',
    model_id: 'gpt-4o',
  },
  {
    name: 'Anthropic Claude Sonnet 4',
    base_url: 'https://api.anthropic.com/v1',
    api_type: 'openai-completions',
    model_id: 'claude-sonnet-4-20250514',
  },
  {
    name: 'DeepSeek V3',
    base_url: 'https://api.deepseek.com/v1',
    api_type: 'openai-completions',
    model_id: 'deepseek-chat',
  },
  {
    name: 'Google Gemini 2.5 Pro',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    api_type: 'openai-completions',
    model_id: 'gemini-2.5-pro',
  },
  {
    name: 'Groq Llama 3 70B',
    base_url: 'https://api.groq.com/openai/v1',
    api_type: 'openai-completions',
    model_id: 'llama3-70b-8192',
  },
];

export const HEALTH_THRESHOLDS = {
  GREEN: 95,   // ≥ 95%
  YELLOW: 80,  // 80% - 95%
  // < 80% = RED
};
