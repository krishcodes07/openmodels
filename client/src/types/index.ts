// ============================================
// Shared TypeScript Types
// ============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  icon?: string;
  requiresApiKey: boolean;
}

export interface ModelCapabilities {
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsWebSearch: boolean;
  supportsStreaming: boolean;
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  capabilities: ModelCapabilities;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  thinkingContent?: string | null;
  imageUrls?: string[];
  tokenCount?: number | null;
  parentMessageId?: string | null;
  sources?: string | null;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  imageUrl?: string | null;
  userId?: string | null;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  isPinned?: boolean;
  personaId?: string | null;
  persona?: { id: string; name: string; imageUrl?: string | null } | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  _count?: { messages: number };
}

export interface UserSettings {
  id: string;
  defaultProviderId?: string | null;
  defaultModelId?: string | null;
  theme: string;
  systemPrompt?: string | null;
}

export interface ApiKeyInfo {
  id: string;
  providerId: string;
  configured: boolean;
  updatedAt: string;
}

export interface StreamEvent {
  type: 'content' | 'thinking' | 'done' | 'error' | 'info' | 'sources' | 'regenerated' | 'title' | 'conversationId';
  content?: string;
  conversationId?: string;
  error?: string;
  usingServerKey?: boolean;
  sources?: any[];
  newMessageId?: string;
  parentMessageId?: string;
  title?: string;
}
