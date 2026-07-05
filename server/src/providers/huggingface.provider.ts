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

export class HuggingFaceProvider extends BaseProvider {
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

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.huggingface.baseUrl,
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.huggingface.apiKey;
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

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.huggingface.apiKey);
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
    const key = this.getApiKey(apiKey, config.providers.huggingface.apiKey);
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
