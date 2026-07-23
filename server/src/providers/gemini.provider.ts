import { config } from '../config';
import { ProviderInfo, ProviderModel, ChatRequest } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class GeminiProvider extends OpenAICompatibleProvider {
  readonly info: ProviderInfo = {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google\'s Gemini models via the OpenAI-compatible API',
    requiresApiKey: true,
  };

  protected getBaseUrl(): string {
    return config.providers.gemini.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.gemini.apiKey;
  }

  protected override prepareCompletionParams(request: ChatRequest): Record<string, any> {
    const modelSupportsThinking = request.model.includes('2.5') || request.model.includes('thinking') || request.model.includes('think');
    if (modelSupportsThinking) {
      if (request.thinking === false) {
        return { reasoning_effort: "none" };
      } else if (request.thinking === true) {
        return { reasoning_effort: "medium" };
      }
    }
    return {};
  }

  protected override getKnownModels(): ProviderModel[] {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, efficient model with thinking', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini model', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: true, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-gen fast model', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Lightweight and fast', contextLength: 1048576, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Powerful for complex tasks', contextLength: 2097152, capabilities: { supportsVision: true, supportsThinking: false, supportsWebSearch: false, supportsStreaming: true } },
    ];
  }

  override async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const key = apiKey || this.getDefaultApiKey();
      if (!key) return this.getKnownModels();

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (!data.models) return this.getKnownModels();

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
      return this.getKnownModels();
    }
  }
}
