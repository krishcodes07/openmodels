import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 200+ models from one API — many free tiers available',
    requiresApiKey: false,
  };

  protected getBaseUrl(): string {
    return config.providers.openrouter.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.openrouter.apiKey;
  }

  protected override getCustomHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': config.clientUrl,
      'X-Title': 'OpenModels',
    };
  }

  protected override getKnownModels(): ProviderModel[] {
    return [
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', description: 'Google Gemini 2.0 Flash — free tier', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick (Free)', description: 'Meta Llama 4 Maverick — free tier', contextLength: 131072, capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (Free)', description: 'DeepSeek V3 chat — free tier', contextLength: 131072, capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen 3 235B (Free)', description: 'Alibaba Qwen3 — free tier', contextLength: 40960, capabilities: { supportsVision: false, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 (Free)', description: 'Mistral Small 24B — free tier', contextLength: 131072, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
    ];
  }

  override async listModels(_apiKey?: string): Promise<ProviderModel[]> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const data = await res.json();
      if (!data.data) return this.getKnownModels();

      return data.data
        .filter((m: any) => m.id && m.name)
        .slice(0, 80)
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description?.substring(0, 120) || '',
          contextLength: m.context_length || undefined,
          capabilities: {
            supportsVision: m.architecture?.modality?.includes('image') || false,
            supportsThinking: m.id.includes('deepseek-r1') || m.id.includes('thinking') || false,
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        }));
    } catch (err) {
      console.error('[OpenRouter] Failed to fetch models:', err);
      return this.getKnownModels();
    }
  }
}
