import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class AgnesProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'agnes',
    name: 'Agnes AI',
    description: 'Free OpenAI-compatible API gateway with text, vision, and image generation models',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'agnes-2.5-flash',
      name: 'Agnes 2.5 Flash',
      description: 'Latest Agnes model optimized for coding and agentic tasks',
      contextLength: 131072,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'agnes-2.0-flash',
      name: 'Agnes 2.0 Flash',
      description: 'Fast and capable text & vision model',
      contextLength: 131072,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'agnes-1.5-flash',
      name: 'Agnes 1.5 Flash',
      description: 'Efficient general-purpose model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.agnes.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.agnes.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch(`${config.providers.agnes.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Agnes] API returned non-OK status: ${res.status}`);
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
          description: `Agnes AI model: ${m.id}`,
          capabilities: {
            supportsVision: m.id.includes('vision') || m.id.includes('multimodal') || m.id.includes('vl') || m.id.includes('2.0') || m.id.includes('2.5'),
            supportsThinking: m.id.includes('r1') || m.id.includes('reasoning') || m.id.includes('think'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Agnes] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
