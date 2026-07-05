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

export class GeminiProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google\'s Gemini models via the OpenAI-compatible API',
    requiresApiKey: true,
  };

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.gemini.baseUrl,
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.gemini.apiKey;
      if (!key) return this.getFallbackModels();

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (!data.models) return this.getFallbackModels();

      return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => {
          const id = m.name.replace('models/', '');
          return {
            id,
            name: m.displayName || id,
            description: m.description?.substring(0, 120) || '',
            contextLength: m.inputTokenLimit || undefined,
            capabilities: {
              supportsVision: m.supportedGenerationMethods?.includes('generateContent') && (id.includes('vision') || id.includes('flash') || id.includes('pro')),
              supportsThinking: id.includes('thinking') || id.includes('think'),
              supportsWebSearch: false,
              supportsStreaming: true,
            },
          };
        })
        .slice(0, 30);
    } catch (err) {
      console.error('[Gemini] Failed to fetch models:', err);
      return this.getFallbackModels();
    }
  }

  private getFallbackModels(): ProviderModel[] {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, efficient model with thinking', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini model', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-gen fast model', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Lightweight and fast', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Powerful for complex tasks', contextLength: 2097152, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
    ];
  }

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.gemini.apiKey);
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

    const modelSupportsThinking = request.model.includes('2.5') || request.model.includes('thinking') || request.model.includes('think');
    if (modelSupportsThinking) {
      if (request.thinking === false) {
        completionOptions.reasoning_effort = "none";
      } else if (request.thinking === true) {
        completionOptions.reasoning_effort = "medium";
      }
    }

    const response = await client.chat.completions.create(completionOptions);

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
    const key = this.getApiKey(apiKey, config.providers.gemini.apiKey);
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

    const modelSupportsThinking = request.model.includes('2.5') || request.model.includes('thinking') || request.model.includes('think');
    if (modelSupportsThinking) {
      if (request.thinking === false) {
        completionOptions.reasoning_effort = "none";
      } else if (request.thinking === true) {
        completionOptions.reasoning_effort = "medium";
      }
    }

    const stream = await client.chat.completions.create(completionOptions) as any;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta) {
        if (delta.content) {
          onChunk({ content: delta.content, done: false });
        }
        if (delta.reasoning_content) {
          onChunk({ thinkingContent: delta.reasoning_content, done: false });
        }
      }
    }

    onChunk({ done: true });
  }
}
