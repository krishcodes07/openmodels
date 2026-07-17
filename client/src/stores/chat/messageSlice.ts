import type { StateCreator } from 'zustand';
import type { ChatState } from './types';
import { api } from '../../services/api';
import { useAuthStore } from '../authStore';
import { pruneAnonymousHistory } from './anonymousSlice';
import type { Conversation, Message, StreamEvent } from '../../types';

export interface MessageSlice {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isStreaming: boolean;
  streamingContent: string;
  thinkingContent: string;
  usingServerKey: boolean;
  activeStreams: Record<string, AbortController>;
  streamingContents: Record<string, string>;
  thinkingContents: Record<string, string>;
  streamingSources: Record<string, any[] | null>;
  regeneratingMessageIds: Record<string, string | null>;
  activeVersionMap: Record<string, string>;
  activeSources: any[] | null;
  isSourcesOpen: boolean;
  regeneratingMessageId: string | null;

  fetchConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createNewChat: (personaId?: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  sendMessage: (content: string, imageUrls?: string[]) => Promise<void>;
  regenerateResponse: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  stopResponse: (conversationId: string) => void;
  togglePinConversation: (id: string) => Promise<void>;
  setVersion: (userMessageId: string, assistantMessageId: string) => void;
  setSourcesOpen: (open: boolean) => void;
}

export const createMessageSlice: StateCreator<ChatState, [], [], MessageSlice> = (set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isStreaming: false,
  streamingContent: '',
  thinkingContent: '',
  usingServerKey: false,
  activeStreams: {},
  streamingContents: {},
  thinkingContents: {},
  streamingSources: {},
  regeneratingMessageIds: {},
  activeVersionMap: {},
  activeSources: null,
  isSourcesOpen: false,
  regeneratingMessageId: null,

  fetchConversations: async () => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      const anonConvs = get().anonymousConversations || [];
      const sorted = [...anonConvs].sort((a, b) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      set({ conversations: sorted, anonymousConversations: sorted, isLoadingConversations: false });
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
        activePersonaId: conversation?.personaId || null,
      });
      if (conversation) {
        await get().fetchModels(conversation.providerId);
      }
      return;
    }
    try {
      set({ isLoadingMessages: true });
      const data = await api.getConversation(id);
      const rawMessages = data.conversation.messages || [];

      set({
        currentConversation: data.conversation,
        messages: rawMessages,
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
        activePersonaId: data.conversation.personaId || null,
      });
      await get().fetchModels(data.conversation.providerId);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      set({ isLoadingMessages: false });
    }
  },

  createNewChat: (personaId?: string) => {
    set({
      currentConversation: null,
      messages: [],
      streamingContent: '',
      thinkingContent: '',
      usingServerKey: false,
      isStreaming: false,
      activeVersionMap: {},
      activeSources: null,
      isSourcesOpen: false,
      regeneratingMessageId: null,
      activeSandboxCode: null,
      activeSandboxOriginalCode: null,
      activeSandboxLanguage: null,
      isSandboxOpen: false,
      activePersonaId: personaId || null,
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
            personaId: state.activePersonaId || null,
            persona: state.activePersonaId ? state.personas.find(p => p.id === state.activePersonaId) || null : null,
          };

      // Set state and apply garbage collection on anonymous chats
      const nextMessages = [...state.messages, tempUserMsg];
      const nextAnonConvs = originConversationId 
        ? state.anonymousConversations.map(c => c.id === originConversationId ? { ...c, updatedAt: new Date().toISOString() } : c)
        : [tempConversation, ...state.anonymousConversations];

      const sortedAnonConvs = [...nextAnonConvs].sort((a, b) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      const initialAnonMsgs = {
        ...state.anonymousMessages,
        [boundConversationId]: nextMessages,
      };

      // Run local storage pruning to keep size within browser limits
      const pruned = pruneAnonymousHistory(sortedAnonConvs, initialAnonMsgs);

      localStorage.setItem('anonymousConversations', JSON.stringify(pruned.conversations));
      localStorage.setItem('anonymousMessages', JSON.stringify(pruned.messages));

      const controller = new AbortController();
      const nextStreams = { ...state.activeStreams, [boundConversationId]: controller };

      set({
        messages: nextMessages,
        anonymousMessages: pruned.messages,
        isStreaming: true,
        streamingContent: '',
        thinkingContent: '',
        usingServerKey: false,
        currentConversation: originConversationId ? pruned.conversations.find(c => c.id === originConversationId) || tempConversation : tempConversation,
        conversations: pruned.conversations,
        anonymousConversations: pruned.conversations,
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
            personaId: state.activePersonaId || undefined,
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
                ...(event.type === 'info' && event.usingServerKey && !sessionStorage.getItem('dismissedServerKeyWarning') ? { usingServerKey: true } : {}),
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
        const currentActive = get().activeStreams[boundConversationId];
        if (currentActive && currentActive !== controller) {
          return;
        }

        if (err.name === 'AbortError') {
          return;
        }

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

    const originConversationId = state.currentConversation?.id || null;
    const originProviderId = state.selectedProviderId;
    const originModelId = state.selectedModelId;

    const tempTitle = content.substring(0, 100).trim() || 'New Chat';

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: originConversationId || '',
      role: 'USER',
      content,
      imageUrls: imageUrls || [],
      createdAt: new Date().toISOString(),
    };

    const tempConversation: Conversation = originConversationId
      ? state.currentConversation!
      : {
          id: `pending-${Date.now()}`,
          title: tempTitle,
          providerId: originProviderId,
          modelId: originModelId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          personaId: state.activePersonaId || null,
          persona: state.activePersonaId ? state.personas.find(p => p.id === state.activePersonaId) || null : null,
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

    let streamedConvId: string | null = null;

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
          personaId: state.activePersonaId || undefined,
        },
        (event: StreamEvent) => {
          const current = get();

          if (event.conversationId) {
            streamedConvId = event.conversationId;
          }

          const targetId = event.conversationId || streamedConvId;
          const streamId = targetId || streamKey;

          if (targetId && targetId !== streamKey) {
            const currentStreams = get().activeStreams;
            if (currentStreams[streamKey]) {
              const updatedStreams = { ...currentStreams };
              updatedStreams[targetId] = updatedStreams[streamKey];
              delete updatedStreams[streamKey];

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

          set({
            streamingContents: { ...get().streamingContents, [streamId]: nextContent },
            thinkingContents: { ...get().thinkingContents, [streamId]: nextThinking },
            streamingSources: { ...get().streamingSources, [streamId]: nextSources },
          });

          const currentViewId = current.currentConversation?.id;
          const isStillViewing = (
            (originConversationId && currentViewId === originConversationId) ||
            (!originConversationId && currentViewId === tempConversation?.id) ||
            (!originConversationId && targetId && currentViewId === targetId)
          );

          if (!isStillViewing) {
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

          if (event.type === 'conversationId' && event.conversationId) {
            // Immediately update the pending conversation ID to the real server ID
            const realId = event.conversationId;
            const pendingId = tempConversation?.id;
            if (pendingId && realId !== pendingId) {
              set({
                currentConversation: current.currentConversation
                  ? { ...current.currentConversation, id: realId }
                  : null,
                conversations: current.conversations.map(c =>
                  c.id === pendingId ? { ...c, id: realId } : c
                ),
              });
            }
          } else if (event.type === 'info' && event.usingServerKey && !sessionStorage.getItem('dismissedServerKeyWarning')) {
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
            
            // If a new stream (edit/regenerate) replaced ours, don't clean up
            const doneStreamOwner = get().activeStreams[finalConvId];
            if (doneStreamOwner && doneStreamOwner !== controller) {
              return;
            }

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
              regeneratingMessageId: null,
            });

            api.getConversation(finalConvId)
              .then((data) => {
                // Re-check: if a new stream started while we were fetching, don't overwrite
                const currentStreamAfterFetch = get().activeStreams[finalConvId];
                if (currentStreamAfterFetch) {
                  return; // A new stream is active, don't overwrite its state
                }
                set({
                  messages: data.conversation.messages || [],
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  currentConversation: data.conversation,
                  regeneratingMessageId: null,
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
                // Re-check before setting fallback state
                const currentStreamAfterFetch = get().activeStreams[finalConvId];
                if (currentStreamAfterFetch) {
                  return;
                }
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

      // CRITICAL: If a new stream (from editMessage/regenerate) has replaced
      // ours, bail out immediately WITHOUT cleaning up — the new stream owns
      // the activeStreams entry and streamingContents now.
      const currentActive = get().activeStreams[activeId];
      if (currentActive && currentActive !== controller) {
        return;
      }

      // Safe to clean up — no new stream has replaced ours.
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
        // stopResponse and editMessage handle their own state after aborting.
        const isCurrent = (
          (originConversationId && current.currentConversation?.id === originConversationId) ||
          (!originConversationId && (current.currentConversation?.id === tempConversation.id || current.currentConversation?.id === activeId))
        );
        if (isCurrent) {
          set({
            isStreaming: false,
            streamingContent: '',
            thinkingContent: '',
          });
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

        // If the error is "Conversation not found", the server deleted the
        // conversation (e.g. after a previous provider error). Reset so the
        // next message creates a fresh conversation.
        const isConvGone = error.message && error.message.includes('Conversation not found');
        const convCleanup = isConvGone ? {
          currentConversation: null,
          conversations: current.conversations.filter(c => c.id !== current.currentConversation?.id),
        } : {};

        set({
          messages: [...current.messages, errorMsg],
          isStreaming: false,
          streamingContent: '',
          thinkingContent: '',
          ...convCleanup,
        });
      }
      console.error('Chat error:', error);
    }
  },

  regenerateResponse: async (messageId: string) => {
    const state = get();
    const originConversationId = state.currentConversation?.id;
    if (!originConversationId) return;

    // Abort any active stream for this conversation before starting regeneration
    const existingController = state.activeStreams[originConversationId];
    if (existingController) {
      existingController.abort();
    }

    const originProviderId = state.selectedProviderId;
    const originModelId = state.selectedModelId;
    const isAuthenticated = useAuthStore.getState().isAuthenticated;

    if (!isAuthenticated) {
      if (state.anonymousMessageCount >= 5) {
        set({ showAuthLimitModal: true });
        return;
      }

      // Increment anonymousMessageCount
      const nextMessageCount = state.anonymousMessageCount + 1;
      localStorage.setItem('anonymousMessageCount', String(nextMessageCount));
      set({ anonymousMessageCount: nextMessageCount });

      const controller = new AbortController();
      const nextStreams = { ...state.activeStreams, [originConversationId]: controller };
      const nextRegens = { ...state.regeneratingMessageIds, [originConversationId]: messageId };

      // Find user message in state
      const targetUserMsgIndex = state.messages.findIndex(m => m.id === messageId);
      if (targetUserMsgIndex === -1) return;
      const targetUserMsg = state.messages[targetUserMsgIndex];

      // Slice messages up to the user message to strip the previous assistant response
      const historyMessages = state.messages.slice(0, targetUserMsgIndex);
      const nextMessages = [...historyMessages, targetUserMsg];

      // Clean up downstream messages in the active view
      set({
        messages: nextMessages,
        isStreaming: true,
        streamingContent: '',
        thinkingContent: '',
        activeSources: null,
        regeneratingMessageId: messageId,
        activeStreams: nextStreams,
        regeneratingMessageIds: nextRegens,
        streamingContents: { ...state.streamingContents, [originConversationId]: '' },
        thinkingContents: { ...state.thinkingContents, [originConversationId]: '' },
        streamingSources: { ...state.streamingSources, [originConversationId]: null },
      });

      try {
        await api.streamChat(
          {
            conversationId: originConversationId,
            message: targetUserMsg.content,
            providerId: originProviderId,
            modelId: originModelId,
            thinking: state.thinkingEnabled,
            webSearch: state.webSearchEnabled,
            imageUrls: targetUserMsg.imageUrls,
            messages: historyMessages.map((m: any) => ({
              role: m.role.toLowerCase(),
              content: m.content,
              imageUrls: m.imageUrls,
            })),
          },
          (event: StreamEvent) => {
            const current = get();
            const currentContent = current.streamingContents[originConversationId] || '';
            const currentThinking = current.thinkingContents[originConversationId] || '';
            
            let nextContent = currentContent;
            let nextThinking = currentThinking;
            let nextSources = current.streamingSources[originConversationId] || null;

            if (event.type === 'sources') {
              nextSources = event.sources ?? null;
            } else if (event.type === 'content') {
              nextContent = currentContent + (event.content || '');
            } else if (event.type === 'thinking') {
              nextThinking = currentThinking + (event.content || '');
            }

            const isStillViewing = current.currentConversation?.id === originConversationId;

            set({
              streamingContents: { ...current.streamingContents, [originConversationId]: nextContent },
              thinkingContents: { ...current.thinkingContents, [originConversationId]: nextThinking },
              streamingSources: { ...current.streamingSources, [originConversationId]: nextSources },
              ...(isStillViewing ? {
                ...(event.type === 'info' && event.usingServerKey && !sessionStorage.getItem('dismissedServerKeyWarning') ? { usingServerKey: true } : {}),
                ...(event.type === 'sources' ? { activeSources: event.sources } : {}),
                ...(event.type === 'content' ? { streamingContent: nextContent } : {}),
                ...(event.type === 'thinking' ? { thinkingContent: nextThinking } : {}),
              } : {})
            });

            if (event.type === 'done') {
              const assistantMsg: Message = {
                id: `msg-${Date.now()}`,
                conversationId: originConversationId,
                role: 'ASSISTANT',
                content: nextContent,
                thinkingContent: nextThinking || null,
                sources: nextSources ? JSON.stringify(nextSources) : null,
                createdAt: new Date().toISOString(),
              };

              // Re-construct the final messages list for the conversation in localStorage
              const finalMessages = [...nextMessages, assistantMsg];
              const finalAnonMsgs = {
                ...current.anonymousMessages,
                [originConversationId]: finalMessages,
              };
              localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));

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
                anonymousMessages: finalAnonMsgs,
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
                regeneratingMessageIds: cleanedRegens,
                ...(isStillViewing ? {
                  messages: finalMessages,
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  regeneratingMessageId: null,
                } : {})
              });

              if (nextMessageCount >= 5) {
                set({ showAuthLimitModal: true });
              }
            } else if (event.type === 'error') {
              const errorMsg: Message = {
                id: `error-${Date.now()}`,
                conversationId: originConversationId,
                role: 'ASSISTANT',
                content: `⚠️ **Error generating response:** ${event.error || 'Unknown error occurred.'}`,
                createdAt: new Date().toISOString(),
              };

              const finalMessages = [...nextMessages, errorMsg];
              const finalAnonMsgs = {
                ...current.anonymousMessages,
                [originConversationId]: finalMessages,
              };
              localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));

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
                anonymousMessages: finalAnonMsgs,
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
                regeneratingMessageIds: cleanedRegens,
                ...(isStillViewing ? {
                  messages: finalMessages,
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  regeneratingMessageId: null,
                } : {})
              });
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
          isStreaming: false,
          streamingContent: '',
          thinkingContent: '',
          regeneratingMessageId: null,
        });

        console.error('Regeneration error:', error);
      }
      return;
    }

    const controller = new AbortController();
    const nextStreams = { ...state.activeStreams, [originConversationId]: controller };

    const nextRegens = { ...state.regeneratingMessageIds, [originConversationId]: messageId };
    set({
      isStreaming: true,
      streamingContent: '',
      thinkingContent: '',
      activeSources: null,
      regeneratingMessageId: messageId,
      activeStreams: nextStreams,
      regeneratingMessageIds: nextRegens,
      streamingContents: { ...state.streamingContents, [originConversationId]: '' },
      thinkingContents: { ...state.thinkingContents, [originConversationId]: '' },
      streamingSources: { ...state.streamingSources, [originConversationId]: null },
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
      const currentActive = get().activeStreams[originConversationId];
      if (currentActive && currentActive !== controller) {
        return;
      }

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
          set({
            isStreaming: false,
            streamingContent: '',
            thinkingContent: '',
            regeneratingMessageId: null,
          });
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

  editMessage: async (messageId: string, newContent: string) => {
    const state = get();
    const originConversationId = state.currentConversation?.id;
    if (!originConversationId) return;

    // Abort any active stream for this conversation before starting the edit
    const existingController = state.activeStreams[originConversationId];
    if (existingController) {
      existingController.abort();
    }

    const originProviderId = state.selectedProviderId;
    const originModelId = state.selectedModelId;
    const isAuthenticated = useAuthStore.getState().isAuthenticated;

    const controller = new AbortController();
    const nextStreams = { ...state.activeStreams, [originConversationId]: controller };

    const targetMsgIndex = state.messages.findIndex(m => m.id === messageId);
    if (targetMsgIndex === -1) return;

    const updatedUserMsg = {
      ...state.messages[targetMsgIndex],
      content: newContent,
    };
    let nextMessages = [...state.messages.slice(0, targetMsgIndex), updatedUserMsg];

    if (!isAuthenticated) {
      if (state.anonymousMessageCount >= 5) {
        set({ showAuthLimitModal: true });
        return;
      }

      // Increment anonymousMessageCount
      const nextMessageCount = state.anonymousMessageCount + 1;
      localStorage.setItem('anonymousMessageCount', String(nextMessageCount));
      set({ anonymousMessageCount: nextMessageCount });

      const nextAnonConvs = state.anonymousConversations.map(c =>
        c.id === originConversationId ? { ...c, updatedAt: new Date().toISOString() } : c
      );
      const sortedAnonConvs = [...nextAnonConvs].sort((a, b) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      const nextAnonMsgs = {
        ...state.anonymousMessages,
        [originConversationId]: nextMessages,
      };

      const pruned = pruneAnonymousHistory(sortedAnonConvs, nextAnonMsgs);

      localStorage.setItem('anonymousConversations', JSON.stringify(pruned.conversations));
      localStorage.setItem('anonymousMessages', JSON.stringify(pruned.messages));

      set({
        messages: nextMessages,
        anonymousMessages: pruned.messages,
        conversations: pruned.conversations,
        anonymousConversations: pruned.conversations,
        isStreaming: true,
        streamingContent: '',
        thinkingContent: '',
        activeSources: null,
        activeStreams: nextStreams,
        regeneratingMessageId: messageId,
        streamingContents: { ...state.streamingContents, [originConversationId]: '' },
        thinkingContents: { ...state.thinkingContents, [originConversationId]: '' },
        streamingSources: { ...state.streamingSources, [originConversationId]: null },
      });

      try {
        await api.streamChat(
          {
            conversationId: originConversationId,
            message: newContent,
            providerId: originProviderId,
            modelId: originModelId,
            thinking: state.thinkingEnabled,
            webSearch: state.webSearchEnabled,
            imageUrls: updatedUserMsg.imageUrls,
            messages: nextMessages.slice(0, -1).map((m: any) => ({
              role: m.role.toLowerCase(),
              content: m.content,
              imageUrls: m.imageUrls,
            })),
          },
          (event: StreamEvent) => {
            const current = get();
            const currentContent = current.streamingContents[originConversationId] || '';
            const currentThinking = current.thinkingContents[originConversationId] || '';
            
            let nextContent = currentContent;
            let nextThinking = currentThinking;
            let nextSources = current.streamingSources[originConversationId] || null;

            if (event.type === 'sources') {
              nextSources = event.sources ?? null;
            } else if (event.type === 'content') {
              nextContent = currentContent + (event.content || '');
            } else if (event.type === 'thinking') {
              nextThinking = currentThinking + (event.content || '');
            }

            const isStillViewing = current.currentConversation?.id === originConversationId;

            set({
              streamingContents: { ...current.streamingContents, [originConversationId]: nextContent },
              thinkingContents: { ...current.thinkingContents, [originConversationId]: nextThinking },
              streamingSources: { ...current.streamingSources, [originConversationId]: nextSources },
              ...(isStillViewing ? {
                ...(event.type === 'info' && event.usingServerKey && !sessionStorage.getItem('dismissedServerKeyWarning') ? { usingServerKey: true } : {}),
                ...(event.type === 'sources' ? { activeSources: event.sources } : {}),
                ...(event.type === 'content' ? { streamingContent: nextContent } : {}),
                ...(event.type === 'thinking' ? { thinkingContent: nextThinking } : {}),
              } : {})
            });

            if (event.type === 'done') {
              const assistantMsg: Message = {
                id: `msg-${Date.now()}`,
                conversationId: originConversationId,
                role: 'ASSISTANT',
                content: nextContent,
                thinkingContent: nextThinking || null,
                sources: nextSources ? JSON.stringify(nextSources) : null,
                createdAt: new Date().toISOString(),
              };
              
              const targetHistory = get().anonymousMessages[originConversationId] || [];
              const finalMessages = [...targetHistory, assistantMsg];
              const finalAnonMsgs = {
                ...get().anonymousMessages,
                [originConversationId]: finalMessages,
              };
              localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));

              const currentStreams = get().activeStreams;
              const nextStreams = { ...currentStreams };
              delete nextStreams[originConversationId];

              const cleanedContents = { ...get().streamingContents };
              delete cleanedContents[originConversationId];
              const cleanedThinkings = { ...get().thinkingContents };
              delete cleanedThinkings[originConversationId];
              const cleanedSources = { ...get().streamingSources };
              delete cleanedSources[originConversationId];

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
                  regeneratingMessageId: null,
                } : {})
              });

              if (nextMessageCount >= 5) {
                set({ showAuthLimitModal: true });
              }
            } else if (event.type === 'error') {
              const assistantMsg: Message = {
                id: `error-${Date.now()}`,
                conversationId: originConversationId,
                role: 'ASSISTANT',
                content: `⚠️ **Error generating response:** ${event.error || 'Unknown error occurred.'}`,
                createdAt: new Date().toISOString(),
              };

              const targetHistory = get().anonymousMessages[originConversationId] || [];
              const finalMessages = [...targetHistory, assistantMsg];
              const finalAnonMsgs = {
                ...get().anonymousMessages,
                [originConversationId]: finalMessages,
              };
              localStorage.setItem('anonymousMessages', JSON.stringify(finalAnonMsgs));

              const currentStreams = get().activeStreams;
              const nextStreams = { ...currentStreams };
              delete nextStreams[originConversationId];

              const cleanedContents = { ...get().streamingContents };
              delete cleanedContents[originConversationId];
              const cleanedThinkings = { ...get().thinkingContents };
              delete cleanedThinkings[originConversationId];
              const cleanedSources = { ...get().streamingSources };
              delete cleanedSources[originConversationId];

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
                  regeneratingMessageId: null,
                } : {})
              });
            }
          },
          controller.signal
        );
      } catch (err: any) {
        // Handle error quietly
      }
      return;
    }

    // For temp IDs (message created during streaming, not yet synced), we need
    // to resolve the real server-side message ID first.
    let resolvedMessageId = messageId;
    if (messageId.startsWith('temp-')) {
      try {
        const data = await api.getConversation(originConversationId);
        const serverMessages = data.conversation.messages || [];
        // Find the last user message — that's the one being edited
        const lastUserMsg = [...serverMessages].reverse().find((m: any) => m.role === 'USER');
        if (lastUserMsg) {
          resolvedMessageId = lastUserMsg.id;
          // Also update local messages with real IDs from server
          const updatedMessages = nextMessages.map((m: any) =>
            m.id === messageId ? { ...m, id: resolvedMessageId } : m
          );
          set({ messages: updatedMessages });
          // Update nextMessages reference for consistency
          nextMessages = updatedMessages;
        }
      } catch (err) {
        console.warn('[EditMessage] Could not resolve temp message ID:', err);
        // If we can't resolve the ID, the edit will likely fail on server
      }
    }

    set({
      messages: nextMessages,
      isStreaming: true,
      streamingContent: '',
      thinkingContent: '',
      activeSources: null,
      activeStreams: nextStreams,
      regeneratingMessageId: resolvedMessageId,
      streamingContents: { ...state.streamingContents, [originConversationId]: '' },
      thinkingContents: { ...state.thinkingContents, [originConversationId]: '' },
      streamingSources: { ...state.streamingSources, [originConversationId]: null },
    });

    try {
      await api.streamEdit(
        {
          conversationId: originConversationId,
          messageId: resolvedMessageId,
          content: newContent,
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

              set({
                activeStreams: nextStreams,
                streamingContents: cleanedContents,
                thinkingContents: cleanedThinkings,
                streamingSources: cleanedSources,
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

            set({
              activeStreams: nextStreams,
              streamingContents: cleanedContents,
              thinkingContents: cleanedThinkings,
              streamingSources: cleanedSources,
            });

            api.getConversation(originConversationId)
              .then((data) => {
                set({
                  messages: data.conversation.messages || [],
                  isStreaming: false,
                  streamingContent: '',
                  thinkingContent: '',
                  currentConversation: data.conversation,
                  regeneratingMessageId: null,
                });
              })
              .catch((err) => {
                console.error('Failed to sync conversation after edit:', err);
              });

            setTimeout(() => get().fetchConversations(), 1000);
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

            set({
              isStreaming: false,
              streamingContent: '',
              thinkingContent: '',
              regeneratingMessageId: null,
              activeStreams: nextStreams,
              streamingContents: cleanedContents,
              thinkingContents: cleanedThinkings,
              streamingSources: cleanedSources,
            });
            console.error('Edit stream error:', event.error);
          }
        },
        controller.signal
      );
    } catch (error: any) {
      const currentActive = get().activeStreams[originConversationId];
      if (currentActive && currentActive !== controller) {
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
      console.error('Edit error:', error);
    }
  },

  stopResponse: (conversationId: string) => {
    const { activeStreams, currentConversation, streamingContent, thinkingContent, messages } = get();
    const controller = activeStreams[conversationId];
    if (controller) {
      controller.abort();
      
      const nextStreams = { ...activeStreams };
      delete nextStreams[conversationId];

      const cleanedContents = { ...get().streamingContents };
      delete cleanedContents[conversationId];
      const cleanedThinkings = { ...get().thinkingContents };
      delete cleanedThinkings[conversationId];
      const cleanedSources = { ...get().streamingSources };
      delete cleanedSources[conversationId];
      const cleanedRegens = { ...get().regeneratingMessageIds };
      delete cleanedRegens[conversationId];
      
      const isCurrent = currentConversation?.id === conversationId;
      const isAuthenticated = useAuthStore.getState().isAuthenticated;

      if (isCurrent && streamingContent && streamingContent.trim()) {
        // Persist the partial content as a finalized assistant message
        const partialMsg: Message = {
          id: `msg-stopped-${Date.now()}`,
          conversationId,
          role: 'ASSISTANT',
          content: streamingContent,
          thinkingContent: thinkingContent || null,
          createdAt: new Date().toISOString(),
        };

        if (!isAuthenticated) {
          // Save to anonymous messages in localStorage
          const currentAnonMsgs = get().anonymousMessages;
          const convMessages = [...messages, partialMsg];
          const nextAnonMsgs = { ...currentAnonMsgs, [conversationId]: convMessages };
          localStorage.setItem('anonymousMessages', JSON.stringify(nextAnonMsgs));
          set({
            activeStreams: nextStreams,
            streamingContents: cleanedContents,
            thinkingContents: cleanedThinkings,
            streamingSources: cleanedSources,
            regeneratingMessageIds: cleanedRegens,
            anonymousMessages: nextAnonMsgs,
            messages: convMessages,
            isStreaming: false,
            streamingContent: '',
            thinkingContent: '',
            regeneratingMessageId: null,
          });
        } else {
          // For authenticated users, show partial immediately in local state
          set({
            activeStreams: nextStreams,
            streamingContents: cleanedContents,
            thinkingContents: cleanedThinkings,
            streamingSources: cleanedSources,
            regeneratingMessageIds: cleanedRegens,
            messages: [...messages, partialMsg],
            isStreaming: false,
            streamingContent: '',
            thinkingContent: '',
            regeneratingMessageId: null,
          });

          // Persist stopped response to backend DB so it survives page refresh
          if (conversationId && !conversationId.startsWith('pending-') && !conversationId.startsWith('anon-')) {
            const lastUserMsg = messages.filter(m => m.role === 'USER').pop();
            api.addMessage(conversationId, {
              role: 'ASSISTANT',
              content: streamingContent + ' 🟥 *[Response stopped by user]*',
              thinkingContent: thinkingContent || null,
              parentMessageId: lastUserMsg?.id || null,
            }).catch(err => console.warn('[stopResponse] Failed to persist stopped message:', err));
          }
        }
      } else {
        set({
          activeStreams: nextStreams,
          streamingContents: cleanedContents,
          thinkingContents: cleanedThinkings,
          streamingSources: cleanedSources,
          regeneratingMessageIds: cleanedRegens,
          ...(isCurrent ? {
            isStreaming: false,
            streamingContent: '',
            thinkingContent: '',
            regeneratingMessageId: null,
          } : {}),
        });
        if (isCurrent && isAuthenticated) {
          setTimeout(() => {
            get().loadConversation(conversationId);
          }, 500);
        }
      }
    }
  },

  togglePinConversation: async (id: string) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      const state = get();
      const nextAnonConvs = state.anonymousConversations.map(c =>
        c.id === id ? { ...c, isPinned: !c.isPinned } : c
      );
      const sortedAnonConvs = [...nextAnonConvs].sort((a, b) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      localStorage.setItem('anonymousConversations', JSON.stringify(sortedAnonConvs));
      set({
        anonymousConversations: sortedAnonConvs,
        conversations: sortedAnonConvs,
        ...(state.currentConversation?.id === id ? {
          currentConversation: { ...state.currentConversation!, isPinned: !state.currentConversation.isPinned },
        } : {}),
      });
      return;
    }
    try {
      const state = get();
      const conv = state.conversations.find(c => c.id === id);
      if (!conv) return;
      const nextPinned = !conv.isPinned;
      await api.updateConversation(id, { isPinned: nextPinned });
      
      const updatedConvs = state.conversations.map(c =>
        c.id === id ? { ...c, isPinned: nextPinned } : c
      );
      const sorted = [...updatedConvs].sort((a, b) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
      set({
        conversations: sorted,
        ...(state.currentConversation?.id === id ? {
          currentConversation: { ...state.currentConversation!, isPinned: nextPinned },
        } : {}),
      });
    } catch (error) {
      console.error('Failed to toggle pin conversation:', error);
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
});
