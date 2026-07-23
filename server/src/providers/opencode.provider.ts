import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class OpenCodeProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'opencode',
    name: 'OpenCode Zen',
    description: 'Curated developer models optimized for high-quality software engineering',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'deepseek-coder',
      name: 'DeepSeek Coder',
      description: 'Highly capable coder model with state-of-the-art programming logic',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'qwen2.5-coder-32b-instruct',
      name: 'Qwen 2.5 Coder 32B',
      description: 'Alibaba\'s optimized model for deep coding instruction and structure',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'meta-llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      description: 'Meta\'s general instruction and code compilation system',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.opencode.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.opencode.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://opencode.ai/zen/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[OpenCode Zen] API returned non-OK status: ${res.status}`);
        return this.knownModels;
      }

      const data = await res.json();
      const modelsList = Array.isArray(data) ? data : (data.data || []);

      if (modelsList.length === 0) {
        return this.knownModels;
      }

      return modelsList.map((m: any) => {
        const known = this.knownModels.find(k => k.id === m.id);
        if (known) return known;

        const name = m.id
          .split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const idLower = m.id.toLowerCase();
        return {
          id: m.id,
          name,
          description: `OpenCode Zen model: ${m.id}`,
          capabilities: {
            supportsVision: idLower.includes('vision') || idLower.includes('vl'),
            supportsThinking: idLower.includes('r1') || idLower.includes('reasoning') || idLower.includes('think'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[OpenCode Zen] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
