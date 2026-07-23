import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class GroqProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference powered by Groq LPU hardware',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      description: 'Versatile 70B model with high quality',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      description: 'Blazing fast 8B model for quick tasks',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'llama-3.2-11b-vision-preview',
      name: 'Llama 3.2 11B Vision',
      description: 'Multimodal model with vision capabilities',
      contextLength: 131072,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'deepseek-r1-distill-llama-70b',
      name: 'DeepSeek R1 Distill 70B',
      description: 'DeepSeek reasoning model distilled into Llama 70B',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'gemma2-9b-it',
      name: 'Gemma 2 9B IT',
      description: 'Google\'s efficient instruction-tuned model',
      contextLength: 8192,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B',
      description: 'Mistral\'s mixture of experts model',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.groq.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.groq.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Groq] API returned non-OK status: ${res.status}`);
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
          description: `Groq model: ${m.id}`,
          capabilities: {
            supportsVision: m.id.includes('vision') || m.id.includes('multimodal') || m.id.includes('vl'),
            supportsThinking: m.id.includes('r1') || m.id.includes('reasoning') || m.id.includes('think'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Groq] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
