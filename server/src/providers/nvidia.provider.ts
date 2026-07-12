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

export class NvidiaProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'Access cutting-edge AI models through NVIDIA NIM microservices',
    requiresApiKey: true,
  };

  // NVIDIA NIM models - dynamically fetched when possible, fallback to curated list
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

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.nvidia.baseUrl,
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.nvidia.apiKey;
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

        const idLower = m.id.toLowerCase();
        const supportsThinking = idLower.includes('r1') || 
                                 idLower.includes('reasoning') || 
                                 idLower.includes('think') || 
                                 idLower.includes('glm-5') || 
                                 idLower.includes('glm-4.7') || 
                                 idLower.includes('glm-4.6') || 
                                 idLower.includes('glm-4.5') || 
                                 idLower.includes('glm-4');

        return {
          id: m.id,
          name,
          description: `NVIDIA NIM model: ${m.id}`,
          capabilities: {
            supportsVision: m.id.includes('vision') || m.id.includes('multimodal') || m.id.includes('vl'),
            supportsThinking,
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

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.nvidia.apiKey);
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

    const idLower = request.model.toLowerCase();
    const modelSupportsThinking = idLower.includes('r1') || 
                                 idLower.includes('reasoning') || 
                                 idLower.includes('think') || 
                                 idLower.includes('glm-5') || 
                                 idLower.includes('glm-4.7') || 
                                 idLower.includes('glm-4.6') || 
                                 idLower.includes('glm-4.5') || 
                                 idLower.includes('glm-4');

    const completionParams: any = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      stream: false,
    };

    if (modelSupportsThinking) {
      completionParams.extra_body = {
        chat_template_kwargs: {
          enable_thinking: request.thinking !== false,
          clear_thinking: false
        }
      };
    }

    const response = await client.chat.completions.create(completionParams);

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
    const key = this.getApiKey(apiKey, config.providers.nvidia.apiKey);
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

    const idLower = request.model.toLowerCase();
    const modelSupportsThinking = idLower.includes('r1') || 
                                 idLower.includes('reasoning') || 
                                 idLower.includes('think') || 
                                 idLower.includes('glm-5') || 
                                 idLower.includes('glm-4.7') || 
                                 idLower.includes('glm-4.6') || 
                                 idLower.includes('glm-4.5') || 
                                 idLower.includes('glm-4');

    const completionParams: any = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 8192,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    if (modelSupportsThinking) {
      completionParams.extra_body = {
        chat_template_kwargs: {
          enable_thinking: request.thinking !== false,
          clear_thinking: false
        }
      };
    }

    const stream = await client.chat.completions.create(completionParams) as any;

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
