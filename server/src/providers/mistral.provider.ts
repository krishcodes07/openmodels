import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class MistralProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'State-of-the-art open-weights models from Europe\'s leading AI lab',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'mistral-medium-2505',
      name: 'Mistral Medium 2505',
      description: 'Mistral medium tier versatile model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      description: 'Mistral\'s flag-ship high-capacity model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'pixtral-12b-2409',
      name: 'Pixtral 12B',
      description: 'Mistral\'s multimodal model supporting image inputs',
      contextLength: 131072,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      description: 'Fast, cost-efficient, and optimized for latency',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'codestral-latest',
      name: 'Codestral',
      description: 'Specialized model trained for code generation and multi-language tasks',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.mistral.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.mistral.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Mistral] API returned non-OK status: ${res.status}`);
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
          description: `Mistral model: ${m.id}`,
          capabilities: {
            supportsVision: idLower.includes('pixtral') || idLower.includes('vision') || idLower.includes('vl'),
            supportsThinking: idLower.includes('r1') || idLower.includes('reasoning') || idLower.includes('think'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Mistral] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
