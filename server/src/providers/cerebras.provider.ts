import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class CerebrasProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'cerebras',
    name: 'Cerebras',
    description: 'Blazing fast inference powered by Cerebras wafer-scale engine CS-3',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'llama-3.3-70b',
      name: 'Llama 3.3 70B',
      description: 'Meta\'s powerful 70B model running at extremely high speed',
      contextLength: 8192,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'llama-3.1-8b',
      name: 'Llama 3.1 8B',
      description: 'Meta\'s ultra-low latency 8B model',
      contextLength: 8192,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.cerebras.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.cerebras.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://api.cerebras.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Cerebras] API returned non-OK status: ${res.status}`);
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

        return {
          id: m.id,
          name,
          description: `Cerebras model: ${m.id}`,
          capabilities: {
            supportsVision: false,
            supportsThinking: false,
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Cerebras] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
