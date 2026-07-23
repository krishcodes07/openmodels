import { config } from '../config';
import { ProviderInfo, ProviderModel, ChatRequest } from './base.provider';
import { OpenAICompatibleProvider } from './compat/openai-compatible.provider';

export class ZaiProvider extends OpenAICompatibleProvider {
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

  protected getBaseUrl(): string {
    return config.providers.zai.baseUrl;
  }

  protected getDefaultApiKey(): string {
    return config.providers.zai.apiKey;
  }

  protected override getKnownModels(): ProviderModel[] {
    return this.knownModels;
  }

  protected override prepareCompletionParams(request: ChatRequest): Record<string, any> {
    const modelSupportsThinking = request.model.includes('5.2') || request.model.includes('5.1') || request.model.includes('4.5') || request.model.includes('reason') || request.model.includes('think');
    if (modelSupportsThinking) {
      if (request.thinking === false) {
        return { thinking: { type: 'disabled' }, reasoning_effort: 'none' };
      } else {
        return { thinking: { type: 'enabled' }, reasoning_effort: 'high' };
      }
    }
    return {};
  }

  override async listModels(): Promise<ProviderModel[]> {
    return this.knownModels;
  }
}
