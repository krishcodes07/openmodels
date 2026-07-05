import OpenAI from 'openai';
import { config } from '../config';
import { localUrlToBase64 } from '../lib/images';
import {
  BaseProvider,
  ProviderInfo,
  ProviderModel,
  ChatRequest,
  ChatResponse,
  StreamChunk,
} from './base.provider';

export class CloudflareProvider extends BaseProvider {
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

  private getClientAndUrl(apiKey: string): { client: OpenAI; baseURL: string } {
    let token = apiKey;
    let accountId = config.providers.cloudflare.accountId;

    if (apiKey.includes(':')) {
      const parts = apiKey.split(':');
      accountId = parts[0].trim();
      token = parts[1].trim();
    }

    const baseURL = `${config.providers.cloudflare.baseUrl}/${accountId}/ai/v1`;

    const client = new OpenAI({
      apiKey: token,
      baseURL,
    });

    return { client, baseURL };
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.cloudflare.apiKey;
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

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.cloudflare.apiKey);
    const { client } = this.getClientAndUrl(key);

    const messages = request.messages.map(m => {
      if (m.imageUrls && m.imageUrls.length > 0) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            ...m.imageUrls.map(url => ({ type: 'image_url', image_url: { url: localUrlToBase64(url) } }))
          ] as any
        };
      }
      return { role: m.role, content: m.content };
    });

    const response = await client.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      stream: false,
    });

    const choice = response.choices[0];
    return {
      content: choice.message?.content || '',
      tokenCount: response.usage?.total_tokens,
      finishReason: choice.finish_reason || undefined,
    };
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    apiKey?: string
  ): Promise<void> {
    const key = this.getApiKey(apiKey, config.providers.cloudflare.apiKey);
    const { client } = this.getClientAndUrl(key);

    const messages = request.messages.map(m => {
      if (m.imageUrls && m.imageUrls.length > 0) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            ...m.imageUrls.map(url => ({ type: 'image_url', image_url: { url: localUrlToBase64(url) } }))
          ] as any
        };
      }
      return { role: m.role, content: m.content };
    });

    const stream = await client.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 8192,
      temperature: request.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as any;
      if (delta) {
        if (delta.reasoning_content) {
          onChunk({ thinkingContent: delta.reasoning_content, done: false });
        }
        if (delta.content) {
          onChunk({ content: delta.content, done: false });
        }
      }
    }

    onChunk({ done: true });
  }
}
