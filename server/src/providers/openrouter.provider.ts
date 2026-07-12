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

export class OpenRouterProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 200+ models from one API — many free tiers available',
    requiresApiKey: false,
  };

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.openrouter.baseUrl,
      defaultHeaders: {
        'HTTP-Referer': config.clientUrl,
        'X-Title': 'OpenModels',
      },
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const data = await res.json();
      if (!data.data) return this.getFallbackModels();

      return data.data
        .filter((m: any) => m.id && m.name)
        .slice(0, 80)
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description?.substring(0, 120) || '',
          contextLength: m.context_length || undefined,
          capabilities: {
            supportsVision: m.architecture?.modality?.includes('image') || false,
            supportsThinking: m.id.includes('deepseek-r1') || m.id.includes('thinking') || false,
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        }));
    } catch (err) {
      console.error('[OpenRouter] Failed to fetch models:', err);
      return this.getFallbackModels();
    }
  }

  private getFallbackModels(): ProviderModel[] {
    return [
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', description: 'Google Gemini 2.0 Flash — free tier', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick (Free)', description: 'Meta Llama 4 Maverick — free tier', contextLength: 131072, capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (Free)', description: 'DeepSeek V3 chat — free tier', contextLength: 131072, capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen 3 235B (Free)', description: 'Alibaba Qwen3 — free tier', contextLength: 40960, capabilities: { supportsVision: false, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 (Free)', description: 'Mistral Small 24B — free tier', contextLength: 131072, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
    ];
  }

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.openrouter.apiKey);
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
    const key = this.getApiKey(apiKey, config.providers.openrouter.apiKey);
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
