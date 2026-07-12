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

export class GroqProvider extends BaseProvider {
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

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.groq.baseUrl,
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.groq.apiKey;
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

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.groq.apiKey);
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
      thinkingContent: (choice.message as any)?.reasoning_content || (choice.message as any)?.thinking || undefined,
      tokenCount: response.usage?.total_tokens,
      finishReason: choice.finish_reason || undefined,
    };
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    apiKey?: string
  ): Promise<void> {
    const key = this.getApiKey(apiKey, config.providers.groq.apiKey);
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
      const delta = chunk.choices[0]?.delta;
      if (delta) {
        if (delta.content) {
          onChunk({ content: delta.content, done: false });
        }
        if ((delta as any).reasoning_content) {
          onChunk({ thinkingContent: (delta as any).reasoning_content, done: false });
        }
        if ((delta as any).thinking) {
          onChunk({ thinkingContent: (delta as any).thinking, done: false });
        }
      }
    }

    onChunk({ done: true });
  }
}
