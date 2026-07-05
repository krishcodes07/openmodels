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

export class GithubModelsProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'github',
    name: 'GitHub Models',
    description: 'Free evaluation models hosted on Azure/GitHub Inference API',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'OpenAI\'s highly efficient fast multimodal model',
      contextLength: 128000,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'OpenAI\'s flagship multimodal model',
      contextLength: 128000,
      capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'meta-llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      description: 'Meta\'s latest high-quality 70B instruction model',
      contextLength: 128000,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'cohere-command-r-plus',
      name: 'Cohere Command R+',
      description: 'Cohere\'s highly capable business and chat model',
      contextLength: 128000,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: config.providers.github.baseUrl,
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || config.providers.github.apiKey;
      if (!key) return this.knownModels;

      // Update the endpoint to GitHub's models catalog
      const res = await fetch('https://models.github.ai/catalog/models', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${key}`,
          'X-GitHub-Api-Version': '2026-03-10'
        },
      });

      if (!res.ok) {
        console.warn(`[GitHub Models] API returned non-OK status: ${res.status}`);
        return this.knownModels;
      }

      const data = await res.json();
      const modelsList = Array.isArray(data) ? data : [];

      if (modelsList.length === 0) {
        return this.knownModels;
      }

      return modelsList.map((m: any) => {
        const known = this.knownModels.find(k => k.id === m.id);
        if (known) return known;

        // Format the name from the model ID (e.g., "openai/gpt-4.1" to "Openai Gpt 4.1")
        const name = m.id
          .split(/[/-]/) // Split by both '/' and '-'
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const idLower = m.id.toLowerCase();
        return {
          id: m.id,
          name: m.name || name, // Use the name from API if available
          description: m.summary || `GitHub Model: ${m.id}`,
          capabilities: {
            supportsVision: idLower.includes('gpt-4') || idLower.includes('vision') || idLower.includes('vl'),
            supportsThinking: idLower.includes('r1') || idLower.includes('reasoning') || idLower.includes('think') || idLower.includes('o1') || idLower.includes('o3'),
            supportsWebSearch: false,
            supportsStreaming: true,
          },
          publisher: m.publisher || 'Unknown',
          version: m.version || '1.0',
        };
      });
    } catch (err) {
      console.error('[GitHub Models] Failed to fetch models:', err);
      return this.knownModels;
    }
  }

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const key = this.getApiKey(apiKey, config.providers.github.apiKey);
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
    const key = this.getApiKey(apiKey, config.providers.github.apiKey);
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
