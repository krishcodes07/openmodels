import type { StateCreator } from 'zustand';
import type { ChatState } from './types';
import { api } from '../../services/api';
import type { Model } from '../../types';

export interface ModelSlice {
  providers: any[];
  models: Model[];
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
    set({
      selectedProviderId: providerId,
      selectedModelId: '',
      models: [],
      messages: filteredMessages,
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
    set({ 
      selectedModelId: modelId,
      messages: filteredMessages,
    });
  },
});
