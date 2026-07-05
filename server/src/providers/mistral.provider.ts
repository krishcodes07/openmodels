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

export class MistralProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'State-of-the-art open-weights models from Europe\'s leading AI lab',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
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

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.mistral.baseUrl,
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.mistral.apiKey;
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

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.mistral.apiKey);
    const client = this.createClient(key);

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
    const key = this.getApiKey(apiKey, config.providers.mistral.apiKey);
    const client = this.createClient(key);

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
      max_tokens: request.maxTokens || 4096,
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
