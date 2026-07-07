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
});
