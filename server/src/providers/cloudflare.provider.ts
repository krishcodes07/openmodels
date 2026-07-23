import OpenAI from 'openai';
import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class CloudflareProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    description: 'Serverless GPU inference running open source models globally on Cloudflare\'s edge network',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: '@cf/meta/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B Instruct',
      description: 'Meta\'s fast and efficient 8B parameter instruction-tuned model on Cloudflare Workers AI',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: '@cf/meta/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B Instruct',
      description: 'Meta\'s high-capacity 70B parameter open model',
      contextLength: 131072,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: '@cf/mistral/mistral-7b-instruct-v0.1',
      name: 'Mistral 7B Instruct',
      description: 'Mistral\'s efficient 7B instruction model',
      contextLength: 8192,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: '@cf/qwen/qwen1.5-14b-chat-or',
      name: 'Qwen 1.5 14B Chat',
      description: 'Alibaba\'s efficient bilingual model optimized for chat',
      contextLength: 32768,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: '@cf/microsoft/phi-3-medium-4k-instruct',
      name: 'Phi 3 Medium 4K',
      description: 'Microsoft\'s medium sized high quality reasoning model',
      contextLength: 4096,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    const accountId = config.providers.cloudflare.accountId;
    return `${config.providers.cloudflare.baseUrl}/${accountId}/ai/v1`;
  }

  protected getDefaultApiKey(): string {
    return config.providers.cloudflare.apiKey;
  }

  protected override createClient(apiKey: string): OpenAI {
    let token = apiKey;
    let accountId = config.providers.cloudflare.accountId;

    if (apiKey.includes(':')) {
      const parts = apiKey.split(':');
      accountId = parts[0].trim();
      token = parts[1].trim();
    }

    const baseURL = `${config.providers.cloudflare.baseUrl}/${accountId}/ai/v1`;

    return new OpenAI({
      apiKey: token,
      baseURL,
    });
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      let token = key;
      let accountId = config.providers.cloudflare.accountId;

      if (key.includes(':')) {
        const parts = key.split(':');
        accountId = parts[0].trim();
        token = parts[1].trim();
      }

      if (!accountId) return this.knownModels;

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      const modelsList = data.result || [];

      if (modelsList.length === 0) {
        return this.knownModels;
      }

      return modelsList.map((m: any) => {
        const props = Object.fromEntries(
          (m.properties || []).map((p: any) => [p.property_id, p.value])
        );

        return {
          id: m.name,
          name: m.name.replace("@cf/", ""),
          description: m.description,
          contextLength: Number(props.context_window) || undefined,
          capabilities: {
            supportsVision: !!props.vision,
            supportsThinking: !!props.reasoning,
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Cloudflare] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
