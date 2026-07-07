import type { Conversation, Message, Provider, Model } from '../../types';

export interface ChatState {
  // Data
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  providers: Provider[];
  models: Model[];

  // Anonymous state
  anonymousConversations: Conversation[];
  anonymousMessages: Record<string, Message[]>;
  anonymousMessageCount: number;
  showAuthLimitModal: boolean;
  setShowAuthLimitModal: (show: boolean) => void;

  // Selection
  selectedProviderId: string;
  selectedModelId: string;

  // UI state
  isStreaming: boolean;
  streamingContent: string;
  thinkingContent: string;
  isSidebarOpen: boolean;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  usingServerKey: boolean;
  activeStreams: Record<string, AbortController>;
  streamingContents: Record<string, string>;
  thinkingContents: Record<string, string>;
  streamingSources: Record<string, any[] | null>;
  regeneratingMessageIds: Record<string, string | null>;

  // Theme
  theme: 'dark' | 'light';

  // Toggles
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;

  // Versioning and sources state
  activeVersionMap: Record<string, string>; // userMessageId -> assistantMessageId
  activeSources: any[] | null;
  isSourcesOpen: boolean;
  regeneratingMessageId: string | null;

  // Sandbox State
  activeSandboxCode: string | null;
  activeSandboxOriginalCode: string | null;
  activeSandboxLanguage: string | null;
  isSandboxOpen: boolean;

  // Actions
  fetchProviders: () => Promise<void>;
  fetchModels: (providerId: string) => Promise<void>;
  selectProvider: (providerId: string) => Promise<void>;
  selectModel: (modelId: string) => void;

  fetchConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createNewChat: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;

  sendMessage: (content: string, imageUrls?: string[]) => Promise<void>;
  regenerateResponse: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  stopResponse: (conversationId: string) => void;
  togglePinConversation: (id: string) => Promise<void>;

  setVersion: (userMessageId: string, assistantMessageId: string) => void;
  setSourcesOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleThinking: () => void;
  toggleWebSearch: () => void;
  toggleTheme: () => void;
  dismissServerKeyWarning: () => void;

  // Sandbox Actions
  openSandbox: (code: string, language: string) => void;
  updateSandboxCode: (code: string) => void;
  closeSandbox: () => void;
  resetSandboxCode: () => void;
}
