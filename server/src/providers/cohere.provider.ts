import OpenAI from 'openai';
import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class CohereProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'cohere',
    name: 'Cohere',
    description: 'Highly capable models for enterprise search, RAG, and reasoning tasks',
    requiresApiKey: true,
  };

  private readonly knownModels: ProviderModel[] = [
    {
      id: 'command-r-plus',
      name: 'Command R+',
      description: 'Cohere\'s flagship model optimized for conversational interactions and RAG tasks',
      contextLength: 128000,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'command-r',
      name: 'Command R',
      description: 'Optimized for high-speed conversational interaction and search tasks',
      contextLength: 128000,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
    {
      id: 'command',
      name: 'Command',
      description: 'Standard instruction model for general text tasks',
      contextLength: 4096,
      capabilities: { supportsVision: false, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true },
    },
  ];

  protected getBaseUrl(): string {
    return config.providers.cohere.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.cohere.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

      const res = await fetch('https://api.cohere.com/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Cohere] API returned non-OK status: ${res.status}`);
        return this.knownModels;
      }

      const data = await res.json();
      const modelsList = data.models || [];

      if (modelsList.length === 0) {
        return this.knownModels;
      }

      return modelsList.map((m: any) => {
        const known = this.knownModels.find(k => k.id === m.name);
        if (known) return known;

        const name = m.name
          .split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return {
          id: m.name,
          name,
          description: `Cohere Model: ${m.name}`,
          contextLength: m.context_length || undefined,
          capabilities: {
            supportsVision: false,
            supportsThinking: false,
            supportsWebSearch: false,
            supportsStreaming: true,
          },
        };
      });
    } catch (err) {
      console.error('[Cohere] Failed to fetch models:', err);
      return this.knownModels;
    }
  }
}
