// ============================================
// Base Provider Interface
// ============================================
// All AI providers must implement this interface.
// This ensures a consistent API across NVIDIA, Groq,
// OpenRouter, and any future providers.

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsWebSearch: boolean;
  supportsStreaming: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrls?: string[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  thinking?: boolean;
  webSearch?: boolean;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  thinkingContent?: string;
  tokenCount?: number;
  finishReason?: string;
}

export interface StreamChunk {
  content?: string;
  thinkingContent?: string;
  done: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  requiresApiKey: boolean;
}

export abstract class BaseProvider {
  abstract readonly info: ProviderInfo;

  abstract listModels(apiKey?: string): Promise<ProviderModel[]>;

  abstract chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse>;

  abstract streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    apiKey?: string
  ): Promise<void>;

  getApiKey(userApiKey?: string, platformApiKey?: string): string {
    const key = userApiKey || platformApiKey || '';
    if (!key) {
      throw new Error(`No API key configured for ${this.info.name}. Please add your API key in Settings.`);
    }
    return key;
  }
}
