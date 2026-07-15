import type { StateCreator } from 'zustand';
import type { ChatState } from './types';
import { api } from '../../services/api';
import type { Model } from '../../types';

export interface ModelSlice {
  providers: any[];
  models: Model[];
  modelsCache: Record<string, Model[]>;
  selectedProviderId: string;
  selectedModelId: string;
  fetchProviders: () => Promise<void>;
  fetchModels: (providerId: string) => Promise<void>;
  selectProvider: (providerId: string) => Promise<void>;
  selectModel: (modelId: string) => void;
}

export const createModelSlice: StateCreator<ChatState, [], [], ModelSlice> = (set, get) => ({
  providers: [],
  models: [],
  modelsCache: {},
  selectedProviderId: 'mistral',
  selectedModelId: 'mistral-medium-2505',

  fetchProviders: async () => {
    try {
      const data = await api.getProviders();
      set({ providers: data.providers });
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  },

  fetchModels: async (providerId: string) => {
    const cache = get().modelsCache || {};
    if (cache[providerId]) {
      set({ models: cache[providerId] });
      const state = get();
      const modelExists = cache[providerId].some((m: Model) => m.id === state.selectedModelId);
      if (!modelExists && cache[providerId].length > 0) {
        set({ selectedModelId: cache[providerId][0].id });
      }
      return;
    }

    try {
      const data = await api.getModels(providerId);
      set({
        models: data.models,
        modelsCache: {
          ...cache,
          [providerId]: data.models,
        },
      });
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
    const currentMessages = get().messages;
    const withoutErrors = currentMessages.filter(m => !m.id.startsWith('error-'));
    const filteredMessages = withoutErrors.filter((m, idx) => {
      if (m.role === 'USER') {
        const nextMsg = withoutErrors[idx + 1];
        if (!nextMsg || nextMsg.role !== 'ASSISTANT') {
          return false;
        }
      }
      return true;
    });
    // If all messages were errors/orphaned, reset the conversation so the next
    // sendMessage creates a fresh one (avoids "Conversation not found" if the
    // server deleted it after a provider error).
    const conversationReset = filteredMessages.length === 0 && currentMessages.length > 0
      ? { currentConversation: null }
      : {};

    const cache = get().modelsCache || {};
    if (cache[providerId]) {
      set({
        selectedProviderId: providerId,
        selectedModelId: cache[providerId].length > 0 ? cache[providerId][0].id : '',
        models: cache[providerId],
        messages: filteredMessages,
        ...conversationReset,
      });
      return;
    }

    set({
      selectedProviderId: providerId,
      selectedModelId: '',
      models: [],
      messages: filteredMessages,
      ...conversationReset,
    });
    try {
      const data = await api.getModels(providerId);
      set({
        models: data.models,
        modelsCache: {
          ...cache,
          [providerId]: data.models,
        },
      });
      if (data.models.length > 0) {
        set({ selectedModelId: data.models[0].id });
      }
    } catch (error) {
      console.error('Failed to fetch models in selectProvider:', error);
    }
  },

  selectModel: (modelId: string) => {
    const currentMessages = get().messages;
    const withoutErrors = currentMessages.filter(m => !m.id.startsWith('error-'));
    const filteredMessages = withoutErrors.filter((m, idx) => {
      if (m.role === 'USER') {
        const nextMsg = withoutErrors[idx + 1];
        if (!nextMsg || nextMsg.role !== 'ASSISTANT') {
          return false;
        }
      }
      return true;
    });
    // If all messages were errors/orphaned, reset the conversation so the next
    // sendMessage creates a fresh one (avoids "Conversation not found" if the
    // server deleted it after a provider error).
    const conversationReset = filteredMessages.length === 0 && currentMessages.length > 0
      ? { currentConversation: null }
      : {};
    set({ 
      selectedModelId: modelId,
      messages: filteredMessages,
      ...conversationReset,
    });
  },
});
