import { create } from 'zustand';
import { api } from '../services/api';
import type { Conversation, Message, Provider, Model, StreamEvent } from '../types';
import { useAuthStore } from './authStore';

interface ChatState {
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

  // UI state — isStreaming is scoped to the CURRENT view, not global
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
  stopResponse: (conversationId: string) => void;

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

const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
// Apply on load
if (savedTheme === 'light') {
  document.documentElement.classList.add('light');
} else {
  document.documentElement.classList.remove('light');
}



export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  providers: [],
  models: [],

  anonymousConversations: JSON.parse(localStorage.getItem('anonymousConversations') || '[]'),
  anonymousMessages: JSON.parse(localStorage.getItem('anonymousMessages') || '{}'),
  anonymousMessageCount: parseInt(localStorage.getItem('anonymousMessageCount') || '0', 10),
  showAuthLimitModal: false,
  setShowAuthLimitModal: (show) => set({ showAuthLimitModal: show }),

  selectedProviderId: 'mistral',
  selectedModelId: 'mistral-medium-2505',

  isStreaming: false,
  streamingContent: '',
  thinkingContent: '',
  activeStreams: {},
  streamingContents: {},
  thinkingContents: {},
  streamingSources: {},
  regeneratingMessageIds: {},
  isSidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  isLoadingConversations: false,
  isLoadingMessages: false,
  usingServerKey: false,

  activeVersionMap: {},
  activeSources: null,
  isSourcesOpen: false,
  regeneratingMessageId: null,

  activeSandboxCode: null,
  activeSandboxOriginalCode: null,
  activeSandboxLanguage: null,
  isSandboxOpen: false,

  theme: savedTheme,

  thinkingEnabled: false,
  webSearchEnabled: false,

  fetchProviders: async () => {
    try {
      const data = await api.getProviders();
      set({ providers: data.providers });
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  },

  fetchModels: async (providerId: string) => {
    try {
      const data = await api.getModels(providerId);
      set({ models: data.models });
      // Auto-select first model if current model not in list
      const state = get();
      const modelExists = data.models.some((m: Model) => m.id === state.selectedModelId);
      if (!modelExists && data.models.length > 0) {
        set({ selectedModelId: data.models[0].id });
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  },

  selectProvider: async (providerId: string) => {
    set({
      selectedProviderId: providerId,
      selectedModelId: '',
      models: [],
    });
    try {
      const data = await api.getModels(providerId);
      set({ models: data.models });
      if (data.models.length > 0) {
        set({ selectedModelId: data.models[0].id });
      }
    } catch (error) {
      console.error('Failed to fetch models in selectProvider:', error);
    }
  },

  selectModel: (modelId: string) => {
    set({ selectedModelId: modelId });
  },

  fetchConversations: async () => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      set(state => ({ conversations: state.anonymousConversations || [], isLoadingConversations: false }));
      return;
    }
    try {
      set({ isLoadingConversations: true });
      const data = await api.getConversations();
      set({ conversations: data.conversations, isLoadingConversations: false });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      set({ isLoadingConversations: false });
    }
  },

  loadConversation: async (id: string) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    const isCurrentlyStreaming = !!get().activeStreams[id];
    const savedStreamingContent = get().streamingContents[id] || '';
    const savedThinkingContent = get().thinkingContents[id] || '';
    const savedSources = get().streamingSources[id] || null;
    const savedRegenId = get().regeneratingMessageIds[id] || null;

    if (!isAuthenticated) {
      const state = get();
      const conversation = state.anonymousConversations.find(c => c.id === id);
      const convMessages = state.anonymousMessages[id] || [];
      set({
        currentConversation: conversation || null,
        messages: convMessages,
        selectedProviderId: conversation?.providerId || state.selectedProviderId,
        selectedModelId: conversation?.modelId || state.selectedModelId,
        isLoadingMessages: false,
        isStreaming: isCurrentlyStreaming,
        streamingContent: savedStreamingContent,
        thinkingContent: savedThinkingContent,
        activeVersionMap: {},
        activeSources: savedSources,
        isSourcesOpen: false,
        regeneratingMessageId: savedRegenId,
        activeSandboxCode: null,
        activeSandboxOriginalCode: null,
        activeSandboxLanguage: null,
        isSandboxOpen: false,
      });
      if (conversation) {
        await get().fetchModels(conversation.providerId);
      }
      return;
    }
    try {
      set({ isLoadingMessages: true });
      const data = await api.getConversation(id);
      set({
        currentConversation: data.conversation,
        messages: data.conversation.messages || [],
        selectedProviderId: data.conversation.providerId,
        selectedModelId: data.conversation.modelId,
        isLoadingMessages: false,
        isStreaming: isCurrentlyStreaming,
        streamingContent: savedStreamingContent,
        thinkingContent: savedThinkingContent,
        activeVersionMap: {},
        activeSources: savedSources,
        isSourcesOpen: false,
        regeneratingMessageId: savedRegenId,
        activeSandboxCode: null,
        activeSandboxOriginalCode: null,
        activeSandboxLanguage: null,
        isSandboxOpen: false,
      });
      await get().fetchModels(data.conversation.providerId);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      set({ isLoadingMessages: false });
    }
  },

  createNewChat: () => {
    set({
      currentConversation: null,
      messages: [],
      streamingContent: '',
      thinkingContent: '',
      usingServerKey: false,
      // CRITICAL: Reset isStreaming for the new chat view.
      // Any ongoing stream in a previous conversation continues in the background
      // and writes to DB, but it won't affect this new chat's UI.
      isStreaming: false,
      activeVersionMap: {},
      activeSources: null,
      isSourcesOpen: false,
      regeneratingMessageId: null,
      activeSandboxCode: null,
      activeSandboxOriginalCode: null,
      activeSandboxLanguage: null,
      isSandboxOpen: false,
    });
  },

  deleteConversation: async (id: string) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      const state = get();
      const nextAnonConvs = state.anonymousConversations.filter(c => c.id !== id);
      const nextAnonMsgs = { ...state.anonymousMessages };
      delete nextAnonMsgs[id];
      localStorage.setItem('anonymousConversations', JSON.stringify(nextAnonConvs));
      localStorage.setItem('anonymousMessages', JSON.stringify(nextAnonMsgs));
      set({
        anonymousConversations: nextAnonConvs,
        anonymousMessages: nextAnonMsgs,
        conversations: nextAnonConvs,
        ...(state.currentConversation?.id === id ? {
          currentConversation: null,
          messages: [],
        } : {}),
      });
      return;
    }
    try {
      await api.deleteConversation(id);
      const state = get();
      set({
        conversations: state.conversations.filter(c => c.id !== id),
        ...(state.currentConversation?.id === id ? {
          currentConversation: null,
          messages: [],
        } : {}),
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },

  renameConversation: async (id: string, title: string) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      const state = get();
      const nextAnonConvs = state.anonymousConversations.map(c =>
        c.id === id ? { ...c, title } : c
      );
      localStorage.setItem('anonymousConversations', JSON.stringify(nextAnonConvs));
      set({
        anonymousConversations: nextAnonConvs,
        conversations: nextAnonConvs,
        ...(state.currentConversation?.id === id ? {
          currentConversation: { ...state.currentConversation!, title },
        } : {}),
      });
      return;
    }
    try {
      await api.updateConversation(id, { title });
      const state = get();
      set({
        conversations: state.conversations.map(c =>
          c.id === id ? { ...c, title } : c
        ),
        ...(state.currentConversation?.id === id ? {
          currentConversation: { ...state.currentConversation!, title },
        } : {}),
      });
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  },

  sendMessage: async (content: string, imageUrls?: string[]) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;

    if (!isAuthenticated) {
      const state = get();
      if (state.anonymousMessageCount >= 5) {
        set({ showAuthLimitModal: true });
        return;
      }

      // Increment anonymousMessageCount
      const nextMessageCount = state.anonymousMessageCount + 1;
      localStorage.setItem('anonymousMessageCount', String(nextMessageCount));
      set({ anonymousMessageCount: nextMessageCount });

      const originConversationId = state.currentConversation?.id || null;
      const originProviderId = state.selectedProviderId;
      const originModelId = state.selectedModelId;

      const tempTitle = content.substring(0, 100).trim() || 'New Chat';

      // Add user message optimistically
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        conversationId: originConversationId || '',
        role: 'USER',
        content,
        imageUrls: imageUrls || [],
        createdAt: new Date().toISOString(),
      };

      const boundConversationId = originConversationId || `anon-${Date.now()}`;
      tempUserMsg.conversationId = boundConversationId;

      const tempConversation: Conversation = originConversationId
        ? state.currentConversation!
        : {
            id: boundConversationId,
            title: tempTitle,
            providerId: originProviderId,
            modelId: originModelId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      // Set state
      const nextMessages = [...state.messages, tempUserMsg];
      const nextAnonConvs = originConversationId 
        ? state.anonymousConversations 
        : [tempConversation, ...state.anonymousConversations];

      // Save user message in local history immediately
      const initialAnonMsgs = {
        ...state.anonymousMessages,
        [boundConversationId]: nextMessages,
      };

      localStorage.setItem('anonymousConversations', JSON.stringify(nextAnonConvs));
      localStorage.setItem('anonymousMessages', JSON.stringify(initialAnonMsgs));

      const controller = new AbortController();
      const nextStreams = { ...state.activeStreams, [boundConversationId]: controller };

      set({
        messages: nextMessages,
        anonymousMessages: initialAnonMsgs,
        isStreaming: true,
        streamingContent: '',
        thinkingContent: '',
        usingServerKey: false,
        currentConversation: tempConversation,
        conversations: nextAnonConvs,
        anonymousConversations: nextAnonConvs,
        activeSources: null,
        activeStreams: nextStreams,
      });

      try {
        await api.streamChat(
          {
            conversationId: boundConversationId,
            message: content,
            providerId: originProviderId,
            modelId: originModelId,
            thinking: state.thinkingEnabled,
            webSearch: state.webSearchEnabled,
            imageUrls,
            messages: state.messages.map((m: any) => ({
              role: m.role.toLowerCase(),
              content: m.content,
              imageUrls: m.imageUrls,
            })),
          },
          (event: StreamEvent) => {
            const current = get();
            
            const currentContent = current.streamingContents[boundConversationId] || '';
            const currentThinking = current.thinkingContents[boundConversationId] || '';
            
            let nextContent = currentContent;
            let nextThinking = currentThinking;
            let nextSources = current.streamingSources[boundConversationId] || null;

            if (event.type === 'sources') {
              nextSources = event.sources ?? null;
            } else if (event.type === 'content') {
              nextContent = currentContent + (event.content || '');
            } else if (event.type === 'thinking') {
              nextThinking = currentThinking + (event.content || '');
            }

            const currentViewId = current.currentConversation?.id;
            const isStillViewing = currentViewId === boundConversationId;

            const nextContents = { ...current.streamingContents, [boundConversationId]: nextContent };
            const nextThinkings = { ...current.thinkingContents, [boundConversationId]: nextThinking };
            const nextSourcesDict = { ...current.streamingSources, [boundConversationId]: nextSources };

            set({
              streamingContents: nextContents,
              thinkingContents: nextThinkings,
              streamingSources: nextSourcesDict,
              ...(isStillViewing ? {
                ...(event.type === 'info' && event.usingServerKey ? { usingServerKey: true } : {}),
                ...(event.type === 'sources' ? { activeSources: event.sources } : {}),
                ...(event.type === 'content' ? { streamingContent: nextContent } : {}),
                ...(event.type === 'thinking' ? { thinkingContent: nextThinking } : {}),
              } : {})
            });

            if (event.type === 'title') {
              const newTitle = event.title || 'New Chat';
              const updatedAnonConvs = current.anonymousConversations.map(c =>
                c.id === boundConversationId ? { ...c, title: newTitle } : c
              );
              localStorage.setItem('anonymousConversations', JSON.stringify(updatedAnonConvs));
              set({
                conversations: updatedAnonConvs,
                anonymousConversations: updatedAnonConvs,
                ...(isStillViewing && current.currentConversation ? {
                  currentConversation: { ...current.currentConversation, title: newTitle }
                } : {})
              });
            } else if (event.type === 'done') {
              const assistantMsg: Message = {
                id: `msg-${Date.now()}`,
                conversationId: boundConversationId,
                role: 'ASSISTANT',
                content: nextContent,
                thinkingContent: nextThinking || null,
                sources: nextSources ? JSON.stringify(nextSources) : null,
                createdAt: new Date().toISOString(),
              };
              
              const targetHistory = current.anonymousMessages[boundConversationId] || [];
              const finalMessages = [...targetHistory, assistantMsg];
              const finalAnonMsgs = {
                ...current.anonymousMessages,
                [boundConversationId]: finalMessages,
              };
              localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));

              const currentStreams = get().activeStreams;
              const nextStreams = { ...currentStreams };
              delete nextStreams[boundConversationId];

              const cleanedContents = { ...get().streamingContents };
              delete cleanedContents[boundConversationId];
              const cleanedThinkings = { ...get().thinkingContents };
              delete cleanedThinkings[boundConversationId];
              const cleanedSources = { ...get().streamingSources };
              delete cleanedSources[boundConversationId];

              set({
                anonymousMessages: finalAnonMsgs,
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
                ...(isStillViewing ? {
                  messages: finalMessages,
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                } : {})
              });

              if (nextMessageCount >= 5) {
                set({ showAuthLimitModal: true });
              }
            } else if (event.type === 'error') {
              const assistantMsg: Message = {
                id: `error-${Date.now()}`,
                conversationId: boundConversationId,
                role: 'ASSISTANT',
                content: `⚠️ **Error generating response:** ${event.error || 'Unknown error occurred.'}`,
                createdAt: new Date().toISOString(),
              };

              const targetHistory = current.anonymousMessages[boundConversationId] || [];
              const finalMessages = [...targetHistory, assistantMsg];
              const finalAnonMsgs = {
                ...current.anonymousMessages,
                [boundConversationId]: finalMessages,
              };
              localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));

              const currentStreams = get().activeStreams;
              const nextStreams = { ...currentStreams };
              delete nextStreams[boundConversationId];

              const cleanedContents = { ...get().streamingContents };
              delete cleanedContents[boundConversationId];
              const cleanedThinkings = { ...get().thinkingContents };
              delete cleanedThinkings[boundConversationId];
              const cleanedSources = { ...get().streamingSources };
              delete cleanedSources[boundConversationId];

              set({
                anonymousMessages: finalAnonMsgs,
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
                ...(isStillViewing ? {
                  messages: finalMessages,
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                } : {})
              });
            }
          },
          controller.signal
        );
      } catch (err: any) {
        const currentStreams = get().activeStreams;
        const nextStreams = { ...currentStreams };
        delete nextStreams[boundConversationId];

        const cleanedContents = { ...get().streamingContents };
        delete cleanedContents[boundConversationId];
        const cleanedThinkings = { ...get().thinkingContents };
        delete cleanedThinkings[boundConversationId];
        const cleanedSources = { ...get().streamingSources };
        delete cleanedSources[boundConversationId];

        set({
          activeStreams: nextStreams,
          streamingContents: cleanedContents,
          thinkingContents: cleanedThinkings,
          streamingSources: cleanedSources,
        });

        if (err.name === 'AbortError') {
          const current = get();
          if (current.currentConversation?.id === boundConversationId) {
            get().loadConversation(boundConversationId);
          }
          return;
        }

        const current = get();
        const targetHistory = current.anonymousMessages[boundConversationId] || [];
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          conversationId: boundConversationId,
          role: 'ASSISTANT',
          content: `⚠️ **API Execution Error:** ${err.message || 'Connection lost or server unavailable.'}`,
          createdAt: new Date().toISOString(),
        };
        const finalMessages = [...targetHistory, errorMsg];
        const finalAnonMsgs = {
          ...current.anonymousMessages,
          [boundConversationId]: finalMessages,
        };
        localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));
        set({
          anonymousMessages: finalAnonMsgs,
          ...(current.currentConversation?.id === boundConversationId ? {
            messages: finalMessages,
            isStreaming: false,
            streamingContent: '',
            thinkingContent: '',
          } : {})
        });
      }
      return;
    }

    const state = get();

    // Snapshot the conversation context at the time the user sends the message.
    const originConversationId = state.currentConversation?.id || null;
    const originProviderId = state.selectedProviderId;
    const originModelId = state.selectedModelId;

    // For new conversations, use the first message as a temporary title
    const tempTitle = content.substring(0, 100).trim() || 'New Chat';

    // Add user message optimistically
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: originConversationId || '',
      role: 'USER',
      content,
      imageUrls: imageUrls || [],
      createdAt: new Date().toISOString(),
    };

    // If this is a new chat, create a temporary conversation object
    const tempConversation: Conversation = originConversationId
      ? state.currentConversation!
      : {
          id: `pending-${Date.now()}`,
          title: tempTitle,
          providerId: originProviderId,
          modelId: originModelId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    const streamKey = originConversationId || tempConversation.id;
    const controller = new AbortController();
    const nextStreams = { ...state.activeStreams, [streamKey]: controller };

    set({
      messages: [...state.messages, tempUserMsg],
      isStreaming: true,
      streamingContent: '',
      thinkingContent: '',
      usingServerKey: false,
      currentConversation: tempConversation,
      activeSources: null,
      activeStreams: nextStreams,
      ...(!originConversationId ? { conversations: [tempConversation, ...state.conversations] } : {}),
    });

    try {
      await api.streamChat(
        {
          conversationId: originConversationId || undefined,
          message: content,
          providerId: originProviderId,
          modelId: originModelId,
          thinking: state.thinkingEnabled,
          webSearch: state.webSearchEnabled,
          imageUrls,
        },
        (event: StreamEvent) => {
          const current = get();

          // Rename key in activeStreams if the server returned a real conversationId
          const targetId = event.conversationId;
          const streamId = targetId || streamKey;

          if (targetId && targetId !== streamKey) {
            const currentStreams = get().activeStreams;
            if (currentStreams[streamKey]) {
              const updatedStreams = { ...currentStreams };
              updatedStreams[targetId] = updatedStreams[streamKey];
              delete updatedStreams[streamKey];

              // Rename other dictionaries
              const nextContents = { ...current.streamingContents };
              if (nextContents[streamKey]) {
                nextContents[targetId] = nextContents[streamKey];
                delete nextContents[streamKey];
              }

              const nextThinkings = { ...current.thinkingContents };
              if (nextThinkings[streamKey]) {
                nextThinkings[targetId] = nextThinkings[streamKey];
                delete nextThinkings[streamKey];
              }

              const nextSourcesDict = { ...current.streamingSources };
              if (nextSourcesDict[streamKey]) {
                nextSourcesDict[targetId] = nextSourcesDict[streamKey];
                delete nextSourcesDict[streamKey];
              }

              set({
                activeStreams: updatedStreams,
                streamingContents: nextContents,
                thinkingContents: nextThinkings,
                streamingSources: nextSourcesDict,
              });
            }
          }

          // Accumulate content in dictionaries for this streamId
          const currentContent = get().streamingContents[streamId] || '';
          const currentThinking = get().thinkingContents[streamId] || '';
          
          let nextContent = currentContent;
          let nextThinking = currentThinking;
          let nextSources = get().streamingSources[streamId] || null;

          if (event.type === 'sources') {
            nextSources = event.sources ?? null;
          } else if (event.type === 'content') {
            nextContent = currentContent + (event.content || '');
          } else if (event.type === 'thinking') {
            nextThinking = currentThinking + (event.content || '');
          }

          // Update dictionaries in store
          set({
            streamingContents: { ...get().streamingContents, [streamId]: nextContent },
            thinkingContents: { ...get().thinkingContents, [streamId]: nextThinking },
            streamingSources: { ...get().streamingSources, [streamId]: nextSources },
          });

          // GUARD: Only update UI if we're still viewing the same conversation.
          const currentViewId = current.currentConversation?.id;
          const isStillViewing = (
            // Same existing conversation
            (originConversationId && currentViewId === originConversationId) ||
            // Same pending new conversation
            (!originConversationId && currentViewId === tempConversation?.id) ||
            // The server has assigned a real ID and we've updated to it
            (!originConversationId && targetId && currentViewId === targetId)
          );

          if (!isStillViewing) {
            // clean up stream and refresh conversations
            if (event.type === 'done') {
              const currentStreams = get().activeStreams;
              const nextStreams = { ...currentStreams };
              delete nextStreams[streamId];

              const cleanedContents = { ...get().streamingContents };
              delete cleanedContents[streamId];
              const cleanedThinkings = { ...get().thinkingContents };
              delete cleanedThinkings[streamId];
              const cleanedSources = { ...get().streamingSources };
              delete cleanedSources[streamId];

              set({
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
              });
              setTimeout(() => get().fetchConversations(), 500);
            }
            return;
          }

          if (event.type === 'info' && event.usingServerKey) {
            set({ usingServerKey: true });
          } else if (event.type === 'sources') {
            set({ activeSources: event.sources });
          } else if (event.type === 'content') {
            set({ streamingContent: nextContent });
          } else if (event.type === 'thinking') {
            set({ thinkingContent: nextThinking });
          } else if (event.type === 'title') {
            const resolvedId = targetId || originConversationId || '';
            const newTitle = event.title || 'New Chat';
            set({
              currentConversation: current.currentConversation
                ? { ...current.currentConversation, title: newTitle, ...(resolvedId ? { id: resolvedId } : {}) }
                : null,
              conversations: current.conversations.map(c =>
                c.id === tempConversation?.id || c.id === resolvedId
                  ? { ...c, title: newTitle, ...(resolvedId ? { id: resolvedId } : {}) }
                  : c
              ),
            });
          } else if (event.type === 'done') {
            const finalConvId = targetId || originConversationId || '';
            
            const currentStreams = get().activeStreams;
            const nextStreams = { ...currentStreams };
            delete nextStreams[finalConvId];

            const cleanedContents = { ...get().streamingContents };
            delete cleanedContents[finalConvId];
            const cleanedThinkings = { ...get().thinkingContents };
            delete cleanedThinkings[finalConvId];
            const cleanedSources = { ...get().streamingSources };
            delete cleanedSources[finalConvId];

            set({
              activeStreams: nextStreams,
              streamingContents: cleanedContents,
              thinkingContents: cleanedThinkings,
              streamingSources: cleanedSources,
            });

            api.getConversation(finalConvId)
              .then((data) => {
                set({
                  messages: data.conversation.messages || [],
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  currentConversation: data.conversation,
                  conversations: get().conversations.map(c =>
                    c.id === tempConversation?.id || c.id === finalConvId
                      ? {
                          ...data.conversation,
                          _count: { messages: data.conversation.messages?.length || 0 }
                        }
                      : c
                  ),
                });
              })
              .catch((err) => {
                console.error('Failed to sync conversation after stream:', err);
                const assistantMsg: Message = {
                  id: `msg-${Date.now()}`,
                  conversationId: finalConvId,
                  role: 'ASSISTANT',
                  content: nextContent,
                  thinkingContent: nextThinking || null,
                  sources: nextSources ? JSON.stringify(nextSources) : null,
                  createdAt: new Date().toISOString(),
                };
                set({
                  messages: [...current.messages, assistantMsg],
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                });
              });

            setTimeout(() => get().fetchConversations(), 1000);
          } else if (event.type === 'error') {
            const finalConvId = targetId || originConversationId || '';
            
            const currentStreams = get().activeStreams;
            const nextStreams = { ...currentStreams };
            delete nextStreams[finalConvId];

            const cleanedContents = { ...get().streamingContents };
            delete cleanedContents[finalConvId];
            const cleanedThinkings = { ...get().thinkingContents };
            delete cleanedThinkings[finalConvId];
            const cleanedSources = { ...get().streamingSources };
            delete cleanedSources[finalConvId];

            const errorMsg: Message = {
              id: `error-${Date.now()}`,
              conversationId: finalConvId,
              role: 'ASSISTANT',
              content: `⚠️ **Error generating response:** ${event.error || 'Unknown error occurred.'}`,
              createdAt: new Date().toISOString(),
            };
            set({
              messages: [...current.messages, errorMsg],
              isStreaming: false,
              streamingContent: '',
              thinkingContent: '',
              activeStreams: nextStreams,
              streamingContents: cleanedContents,
              thinkingContents: cleanedThinkings,
              streamingSources: cleanedSources,
            });
            console.error('Stream error:', event.error);
          }
        },
        controller.signal
      );
    } catch (error: any) {
      const current = get();
      const activeId = current.currentConversation?.id || streamKey;

      const currentStreams = get().activeStreams;
      const nextStreams = { ...currentStreams };
      delete nextStreams[activeId];

      const cleanedContents = { ...get().streamingContents };
      delete cleanedContents[activeId];
      const cleanedThinkings = { ...get().thinkingContents };
      delete cleanedThinkings[activeId];
      const cleanedSources = { ...get().streamingSources };
      delete cleanedSources[activeId];

      set({
        activeStreams: nextStreams,
        streamingContents: cleanedContents,
        thinkingContents: cleanedThinkings,
        streamingSources: cleanedSources,
      });

      if (error.name === 'AbortError') {
        const isStillViewing = (
          (originConversationId && current.currentConversation?.id === originConversationId) ||
          (!originConversationId && (current.currentConversation?.id === tempConversation.id || current.currentConversation?.id === activeId))
        );
        if (isStillViewing) {
          const finalConvId = current.currentConversation?.id || activeId;
          setTimeout(() => {
            get().loadConversation(finalConvId);
          }, 300);
        }
        return;
      }

      const currentViewId = current.currentConversation?.id;
      const isStillViewing = (
        (originConversationId && currentViewId === originConversationId) ||
        (!originConversationId && currentViewId === tempConversation?.id)
      );

      if (isStillViewing) {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          conversationId: current.currentConversation?.id || '',
          role: 'ASSISTANT',
          content: `⚠️ **API Execution Error:** ${error.message || 'Connection lost or server unavailable.'}`,
          createdAt: new Date().toISOString(),
        };
        set({
          messages: [...current.messages, errorMsg],
          isStreaming: false,
          streamingContent: '',
          thinkingContent: '',
        });
      }
      console.error('Chat error:', error);
    }
  },

  setVersion: (userMessageId: string, assistantMessageId: string) => {
    set(state => ({
      activeVersionMap: {
        ...state.activeVersionMap,
        [userMessageId]: assistantMessageId,
      },
    }));
  },

  setSourcesOpen: (open: boolean) => {
    set({ isSourcesOpen: open });
  },

  regenerateResponse: async (messageId: string) => {
    const state = get();
    const originConversationId = state.currentConversation?.id;
    if (!originConversationId) return;

    const originProviderId = state.selectedProviderId;
    const originModelId = state.selectedModelId;

    const controller = new AbortController();
    const nextStreams = { ...state.activeStreams, [originConversationId]: controller };

    // Reset stream state
    const nextRegens = { ...state.regeneratingMessageIds, [originConversationId]: messageId };
    set({
      isStreaming: true,
      streamingContent: '',
      thinkingContent: '',
      activeSources: null,
      regeneratingMessageId: messageId,
      activeStreams: nextStreams,
      regeneratingMessageIds: nextRegens,
    });

    try {
      await api.streamRegenerate(
        {
          conversationId: originConversationId,
          messageId,
          providerId: originProviderId,
          modelId: originModelId,
          thinking: state.thinkingEnabled,
          webSearch: state.webSearchEnabled,
        },
        (event: any) => {
          const current = get();

          const currentContent = current.streamingContents[originConversationId] || '';
          const currentThinking = current.thinkingContents[originConversationId] || '';
          
          let nextContent = currentContent;
          let nextThinking = currentThinking;
          let nextSources = current.streamingSources[originConversationId] || null;

          if (event.type === 'sources') {
            nextSources = event.sources;
          } else if (event.type === 'content') {
            nextContent = currentContent + (event.content || '');
          } else if (event.type === 'thinking') {
            nextThinking = currentThinking + (event.content || '');
          }

          set({
            streamingContents: { ...current.streamingContents, [originConversationId]: nextContent },
            thinkingContents: { ...current.thinkingContents, [originConversationId]: nextThinking },
            streamingSources: { ...current.streamingSources, [originConversationId]: nextSources },
          });

          // Guard checking still viewing same conversation
          const isStillViewing = current.currentConversation?.id === originConversationId;

          if (!isStillViewing) {
            if (event.type === 'done') {
              const currentStreams = get().activeStreams;
              const nextStreams = { ...currentStreams };
              delete nextStreams[originConversationId];

              const cleanedContents = { ...get().streamingContents };
              delete cleanedContents[originConversationId];
              const cleanedThinkings = { ...get().thinkingContents };
              delete cleanedThinkings[originConversationId];
              const cleanedSources = { ...get().streamingSources };
              delete cleanedSources[originConversationId];

              const cleanedRegens = { ...get().regeneratingMessageIds };
              delete cleanedRegens[originConversationId];

              set({
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
                regeneratingMessageIds: cleanedRegens,
              });
            }
            return;
          }

          if (event.type === 'sources') {
            set({ activeSources: event.sources });
          } else if (event.type === 'content') {
            set({ streamingContent: nextContent });
          } else if (event.type === 'thinking') {
            set({ thinkingContent: nextThinking });
          } else if (event.type === 'regenerated') {
            set({
              activeVersionMap: {
                ...current.activeVersionMap,
                [event.parentMessageId]: event.newMessageId,
              },
            });
          } else if (event.type === 'done') {
            const currentStreams = get().activeStreams;
            const nextStreams = { ...currentStreams };
            delete nextStreams[originConversationId];

            const cleanedContents = { ...get().streamingContents };
            delete cleanedContents[originConversationId];
            const cleanedThinkings = { ...get().thinkingContents };
            delete cleanedThinkings[originConversationId];
            const cleanedSources = { ...get().streamingSources };
            delete cleanedSources[originConversationId];

            const cleanedRegens = { ...get().regeneratingMessageIds };
            delete cleanedRegens[originConversationId];

            set({
              activeStreams: nextStreams,
              streamingContents: cleanedContents,
              thinkingContents: cleanedThinkings,
              streamingSources: cleanedSources,
              regeneratingMessageIds: cleanedRegens,
            });

            api.getConversation(originConversationId)
              .then((data) => {
                set({
                  messages: data.conversation.messages || [],
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  regeneratingMessageId: null,
                  currentConversation: data.conversation,
                });
              })
              .catch((err) => {
                console.error('Failed to sync conversation after regenerate:', err);
                const assistantMsg: Message = {
                  id: `msg-${Date.now()}`,
                  conversationId: originConversationId,
                  role: 'ASSISTANT',
                  content: nextContent,
                  thinkingContent: nextThinking || null,
                  sources: nextSources ? JSON.stringify(nextSources) : null,
                  createdAt: new Date().toISOString(),
                };
                set({
                  messages: [...current.messages, assistantMsg],
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  regeneratingMessageId: null,
                });
              });
          } else if (event.type === 'error') {
            const currentStreams = get().activeStreams;
            const nextStreams = { ...currentStreams };
            delete nextStreams[originConversationId];

            const cleanedContents = { ...get().streamingContents };
            delete cleanedContents[originConversationId];
            const cleanedThinkings = { ...get().thinkingContents };
            delete cleanedThinkings[originConversationId];
            const cleanedSources = { ...get().streamingSources };
            delete cleanedSources[originConversationId];

            const cleanedRegens = { ...get().regeneratingMessageIds };
            delete cleanedRegens[originConversationId];

            set({
              isStreaming: false,
              streamingContent: '',
              thinkingContent: '',
              regeneratingMessageId: null,
              activeStreams: nextStreams,
              streamingContents: cleanedContents,
              thinkingContents: cleanedThinkings,
              streamingSources: cleanedSources,
              regeneratingMessageIds: cleanedRegens,
            });
            console.error('Regeneration error:', event.error);
          }
        },
        controller.signal
      );
    } catch (error: any) {
      const currentStreams = get().activeStreams;
      const nextStreams = { ...currentStreams };
      delete nextStreams[originConversationId];

      const cleanedContents = { ...get().streamingContents };
      delete cleanedContents[originConversationId];
      const cleanedThinkings = { ...get().thinkingContents };
      delete cleanedThinkings[originConversationId];
      const cleanedSources = { ...get().streamingSources };
      delete cleanedSources[originConversationId];

      const cleanedRegens = { ...get().regeneratingMessageIds };
      delete cleanedRegens[originConversationId];

      set({
        activeStreams: nextStreams,
        streamingContents: cleanedContents,
        thinkingContents: cleanedThinkings,
        streamingSources: cleanedSources,
        regeneratingMessageIds: cleanedRegens,
      });

      if (error.name === 'AbortError') {
        const current = get();
        if (current.currentConversation?.id === originConversationId) {
          setTimeout(() => {
            get().loadConversation(originConversationId);
          }, 300);
        }
        return;
      }

      const current = get();
      if (current.currentConversation?.id === originConversationId) {
        set({
          isStreaming: false,
          streamingContent: '',
          thinkingContent: '',
          regeneratingMessageId: null,
        });
      }
      console.error('Regeneration error:', error);
    }
  },

  stopResponse: (conversationId: string) => {
    const { activeStreams, currentConversation } = get();
    const controller = activeStreams[conversationId];
    if (controller) {
      controller.abort();
      
      const nextStreams = { ...activeStreams };
      delete nextStreams[conversationId];
      
      const isCurrent = currentConversation?.id === conversationId;
      set({
        activeStreams: nextStreams,
        ...(isCurrent ? { isStreaming: false } : {}),
      });
    }
  },

  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleThinking: () => set(s => ({ thinkingEnabled: !s.thinkingEnabled })),
  toggleWebSearch: () => set(s => ({ webSearchEnabled: !s.webSearchEnabled })),
  dismissServerKeyWarning: () => set({ usingServerKey: false }),

  openSandbox: (code: string, language: string) => set({
    activeSandboxCode: code,
    activeSandboxOriginalCode: code,
    activeSandboxLanguage: language,
    isSandboxOpen: true,
  }),
  updateSandboxCode: (code: string) => set({ activeSandboxCode: code }),
  closeSandbox: () => set({
    activeSandboxCode: null,
    activeSandboxOriginalCode: null,
    activeSandboxLanguage: null,
    isSandboxOpen: false,
  }),
  resetSandboxCode: () => set(s => ({ activeSandboxCode: s.activeSandboxOriginalCode })),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: newTheme });
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  },
}));
