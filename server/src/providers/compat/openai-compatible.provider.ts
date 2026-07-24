import OpenAI from 'openai';
import { localUrlToBase64 } from '../../lib/images';
import {
  BaseProvider,
  ProviderInfo,
  ProviderModel,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ChatMessage,
} from '../base.provider';

export abstract class OpenAICompatibleProvider extends BaseProvider {
  abstract override readonly info: ProviderInfo;

  /**
   * The base URL for the OpenAI compatible endpoint.
   */
  protected abstract getBaseUrl(): string;

  /**
   * The default API key from server configuration (if configured).
   */
  protected abstract getDefaultApiKey(): string;

  /**
   * Optional custom headers for OpenAI SDK instance.
   */
  protected getCustomHeaders(): Record<string, string> | undefined {
    return undefined;
  }

  /**
   * Optional hook to format or modify completion parameters before calling OpenAI chat.completions.create.
   */
  protected prepareCompletionParams(request: ChatRequest): Record<string, any> {
    return {};
  }

  /**
   * Fallback model list if fetching models dynamically fails or API key is missing.
   */
  protected getKnownModels(): ProviderModel[] {
    return [];
  }

  /**
   * Creates an OpenAI client instance with the given API key.
   */
  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: this.getBaseUrl(),
      defaultHeaders: this.getCustomHeaders(),
    });
  }

  /**
   * Formats chat messages into OpenAI-compatible message structure, handling image URLs.
   */
  protected formatMessages(messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(m => {
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
  }

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, this.getDefaultApiKey());
    const client = this.createClient(key);

    const messages = this.formatMessages(request.messages);
    const extraParams = this.prepareCompletionParams(request);

    const completionParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 65536,
      temperature: request.temperature ?? 0.7,
      stream: false,
      ...extraParams,
    };

    const response = await client.chat.completions.create(completionParams);
    const choice = response.choices[0];

    return {
      content: choice.message?.content || '',
      thinkingContent:
        (choice.message as any)?.reasoning_content ||
        (choice.message as any)?.thinking ||
        undefined,
      tokenCount: response.usage?.total_tokens,
      finishReason: choice.finish_reason || undefined,
    };
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    apiKey?: string
  ): Promise<void> {
    const key = this.getApiKey(apiKey, this.getDefaultApiKey());
    const client = this.createClient(key);

    const messages = this.formatMessages(request.messages);
    const extraParams = this.prepareCompletionParams(request);

    const completionParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 65536,
      temperature: request.temperature ?? 0.7,
      stream: true,
      ...extraParams,
    };

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

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    const known = this.getKnownModels();
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return known;

      const client = this.createClient(key);
      const response = await client.models.list();

      if (!response.data || response.data.length === 0) {
        return known;
      }

      return response.data.map((m: any) => {
        const found = known.find(k => k.id === m.id);
        if (found) return found;

        const name = m.id
          .split('/')
          .pop()
          ?.split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') || m.id;

        return {
          id: m.id,
          name,
          description: `${this.info.name} model: ${m.id}`,
          capabilities: {
            supportsVision: m.id.toLowerCase().includes('vision') || m.id.toLowerCase().includes('vl'),
            supportsThinking: m.id.toLowerCase().includes('r1') || m.id.toLowerCase().includes('think'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error(`[${this.info.name}] Failed to fetch models:`, err);
      return known;
    }
  }
}
