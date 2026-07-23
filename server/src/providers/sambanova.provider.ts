import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class SambanovaProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'sambanova',
    name: 'SambaNova',
    description: 'Ultra-fast inference platform optimized for complex open source models',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'Meta-Llama-3.3-70B-Instruct',
      name: 'Llama 3.3 70B Instruct',
      description: 'Meta\'s high-capacity instruction model running on SambaNova SN40L Reconfigurable Dataflow Units',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'Meta-Llama-3.1-8B-Instruct',
      name: 'Llama 3.1 8B Instruct',
      description: 'High-speed 8B instruction model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'DeepSeek-R1',
      name: 'DeepSeek R1',
      description: 'SambaNova powered full DeepSeek R1 model with chain-of-thought capabilities',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.sambanova.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.sambanova.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://api.sambanova.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[SambaNova] API returned non-OK status: ${res.status}`);
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
          description: `SambaNova Model: ${m.id}`,
          capabilities: {
            supportsVision: idLower.includes('vision') || idLower.includes('vl'),
            supportsThinking: idLower.includes('r1') || idLower.includes('reasoning') || idLower.includes('think'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[SambaNova] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
