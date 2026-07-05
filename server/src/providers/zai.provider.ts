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

export class ZaiProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'zai',
    name: 'Z.AI',
    description: 'Advanced GLM series reasoning and multimodal models from Z.AI',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'glm-5.2',
      name: 'GLM 5.2',
      description: 'Flagship reasoning and coding model',
      contextLength: 1_048_576,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-5.1',
      name: 'GLM 5.1',
      description: 'Long-running engineering and coding model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-5',
      name: 'GLM 5',
      description: 'Agentic planning and backend engineering',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-5-turbo',
      name: 'GLM 5 Turbo',
      description: 'Fast inference model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.7',
      name: 'GLM 4.7',
      description: 'Programming and multi-step reasoning',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.7-flashx',
      name: 'GLM 4.7 FlashX',
      description: 'Lightweight high-speed model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.6',
      name: 'GLM 4.6',
      description: 'Coding and tool-use model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.5',
      name: 'GLM 4.5',
      description: 'Hybrid reasoning MoE model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.5-x',
      name: 'GLM 4.5 X',
      description: 'Ultra-fast reasoning model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.5-air',
      name: 'GLM 4.5 Air',
      description: 'Lightweight reasoning model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.5-airx',
      name: 'GLM 4.5 AirX',
      description: 'Ultra-fast lightweight model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4-32b-0414-128k',
      name: 'GLM 4 32B',
      description: '32B parameter model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.7-flash',
      name: 'GLM 4.7 Flash',
      description: 'Free lightweight model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.5-flash',
      name: 'GLM 4.5 Flash',
      description: 'Free reasoning model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: false,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },

    // Vision

    {
      id: 'glm-5v-turbo',
      name: 'GLM 5V Turbo',
      description: 'Vision and multimodal coding model',
      contextLength: 200_000,
      capabilities: {
        supportsVision: true,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.6v',
      name: 'GLM 4.6V',
      description: 'Native multimodal model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: true,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.6v-flashx',
      name: 'GLM 4.6V FlashX',
      description: 'Fast lightweight vision model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: true,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.5v',
      name: 'GLM 4.5V',
      description: 'Advanced multimodal reasoning',
      contextLength: 64_000,
      capabilities: {
        supportsVision: true,
        supportsThinking: true,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-4.6v-flash',
      name: 'GLM 4.6V Flash',
      description: 'Free vision model',
      contextLength: 128_000,
      capabilities: {
        supportsVision: true,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },
    {
      id: 'glm-ocr',
      name: 'GLM OCR',
      description: 'OCR and document understanding',
      capabilities: {
        supportsVision: true,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: true,
      },
    },

    // Image & Video

    {
      id: 'glm-image',
      name: 'GLM Image',
      description: 'Image generation model',
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: false,
      },
    },
    {
      id: 'cogview-4',
      name: 'CogView 4',
      description: 'Image generation model',
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: false,
      },
    },
    {
      id: 'cogvideox-3',
      name: 'CogVideoX 3',
      description: 'Video generation model',
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: false,
      },
    },
    {
      id: 'viduq1',
      name: 'Vidu Q1',
      description: 'Video generation model',
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: false,
      },
    },
    {
      id: 'vidu2',
      name: 'Vidu 2',
      description: 'Fast video generation model',
      capabilities: {
        supportsVision: false,
        supportsThinking: false,
        supportsWebSearch: false,
        supportsStreaming: false,
      },
    },
  ];

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.zai.baseUrl,
    });
  }

  async listModels(): Promise<ProviderModel[]> {
    return this.knownModels;
  }

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.zai.apiKey);
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

    const completionOptions: any = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      stream: false,
    };

    const modelSupportsThinking = request.model.includes('5.2') || request.model.includes('5.1') || request.model.includes('4.5') || request.model.includes('reason') || request.model.includes('think');
    if (modelSupportsThinking) {
      if (request.thinking === false) {
        completionOptions.thinking = { type: 'disabled' };
        completionOptions.reasoning_effort = 'none';
      } else {
        completionOptions.thinking = { type: 'enabled' };
        completionOptions.reasoning_effort = 'high';
      }
    }

    const response = await client.chat.completions.create(completionOptions);

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
    const key = this.getApiKey(apiKey, config.providers.zai.apiKey);
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

    const completionOptions: any = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    const modelSupportsThinking = request.model.includes('5.2') || request.model.includes('5.1') || request.model.includes('4.5') || request.model.includes('reason') || request.model.includes('think');
    if (modelSupportsThinking) {
      if (request.thinking === false) {
        completionOptions.thinking = { type: 'disabled' };
        completionOptions.reasoning_effort = 'none';
      } else {
        completionOptions.thinking = { type: 'enabled' };
        completionOptions.reasoning_effort = 'high';
      }
    }

    const stream = await client.chat.completions.create(completionOptions) as any;

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
