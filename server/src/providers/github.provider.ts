import { config } from '../config';
import { ProviderInfo, ProviderModel } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class GithubModelsProvider extends OpenAICompatibleProvider {
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

  protected getBaseUrl(): string {
    return config.providers.github.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.github.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.knownModels;

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

        const name = m.id
          .split(/[/-]/)
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const idLower = m.id.toLowerCase();
        return {
          id: m.id,
          name: m.name || name,
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
}
