import { config } from '../config';
import { ProviderInfo, ProviderModel, ChatRequest } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class NvidiaProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'Access cutting-edge AI models through NVIDIA NIM microservices',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'meta/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      description: 'Meta\'s powerful 70B parameter instruction-tuned model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'meta/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B Instruct',
      description: 'Fast and efficient 8B parameter model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'meta/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B Instruct',
      description: 'High quality 70B parameter model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'nvidia/llama-3.1-nemotron-70b-instruct',
      name: 'Nemotron 70B Instruct',
      description: 'NVIDIA\'s optimized instruction model',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'deepseek-ai/deepseek-r1',
      name: 'DeepSeek R1',
      description: 'DeepSeek\'s reasoning model with thinking capabilities',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'google/gemma-2-27b-it',
      name: 'Gemma 2 27B IT',
      description: 'Google\'s efficient instruction-tuned model',
      contextLength: 8192,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'microsoft/phi-3-medium-128k-instruct',
      name: 'Phi 3 Medium 128K',
      description: 'Microsoft\'s efficient medium model with large context',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.nvidia.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.nvidia.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  protected override prepareCompletionParams(request: ChatRequest): Record<string, any> {
    const requiresThinkingParams = request.model.toLowerCase().includes('r1');
    if (requiresThinkingParams) {
      return {
        extra_body: {
          chat_template_kwargs: {
            enable_thinking: request.thinking !== false,
            clear_thinking: false,
          },
        },
      };
    }
    return {};
  }

  private supportsThinking(modelId: string): boolean {
    const idLower = modelId.toLowerCase();
    return idLower.includes('r1') ||
           idLower.includes('reasoning') ||
           idLower.includes('think') ||
           idLower.includes('glm-5') ||
           idLower.includes('glm-4') ||
           idLower.includes('qwq') ||
           idLower.includes('o1') ||
           idLower.includes('o3') ||
           idLower.includes('kimi');
  }

  private supportsVision(modelId: string): boolean {
    const idLower = modelId.toLowerCase();
    return idLower.includes('vision') ||
           idLower.includes('multimodal') ||
           idLower.includes('vl') ||
           idLower.includes('llava') ||
           idLower.includes('pixtral') ||
           idLower.includes('molmo') ||
           idLower.includes('fuyu') ||
           idLower.includes('paligemma') ||
           idLower.includes('qwen-vl');
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const client = this.createClient(key);
      const response = await client.models.list();

      if (!response.data || response.data.length === 0) {
        return this.knownModels;
      }

      return response.data.map((m: any) => {
        const known = this.knownModels.find(k => k.id === m.id);
        if (known) return known;

        const name = m.id.split('/').pop()
          ?.split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') || m.id;

        return {
          id: m.id,
          name,
          description: `NVIDIA NIM model: ${m.id}`,
          capabilities: {
            supportsVision: this.supportsVision(m.id),
            supportsThinking: this.supportsThinking(m.id),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Nvidia] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
