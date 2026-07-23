import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'huggingface',
    name: 'HuggingFace',
    description: 'Access model endpoints served via HuggingFace Inference Providers',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'meta-llama/Llama-3.3-70B-Instruct',
      name: 'Llama 3.3 70B Instruct',
      description: 'Meta\'s latest high-quality 70B instruction-tuned model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'deepseek-ai/DeepSeek-R1',
      name: 'DeepSeek R1',
      description: 'DeepSeek\'s reasoning model with thinking capabilities',
      contextLength: 16384,
      capabilities: { supportsVision: false, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'Qwen/Qwen2.5-72B-Instruct',
      name: 'Qwen 2.5 72B Instruct',
      description: 'Alibaba Qwen 2.5 72B parameter instruction-tuned model',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'meta-llama/Llama-3.2-11B-Vision-Instruct',
      name: 'Llama 3.2 11B Vision',
      description: 'Meta\'s multimodal model supporting image inputs',
      contextLength: 131072,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.huggingface.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.huggingface.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://router.huggingface.co/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[HuggingFace] API returned non-OK status: ${res.status}`);
        return this.knownModels;
      }

      const data = await res.json();
      const modelsList = Array.isArray(data) ? data : (data.data || []);

      if (modelsList.length === 0) {
        return this.knownModels;
      }

      return modelsList
        .filter((m: any) => m.id && m.id.includes('/'))
        .map((m: any) => {
          const known = this.knownModels.find(k => k.id === m.id);
          if (known) return known;

          const name = m.id.split('/').pop()
            ?.split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || m.id;

          const idLower = m.id.toLowerCase();
          return {
            id: m.id,
            name,
            description: `HuggingFace model: ${m.id}`,
            capabilities: {
              supportsVision: idLower.includes('vision') || idLower.includes('vl') || idLower.includes('multimodal'),
              supportsThinking: idLower.includes('r1') || idLower.includes('reasoning') || idLower.includes('think'),
              supportsWebSearch: false,
              supportsStreaming: true,
            },
          };
        })
        .slice(0, 30);
    } catch (err) {
      console.error('[HuggingFace] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
