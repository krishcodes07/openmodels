import type { StateCreator } from 'zustand';
import type { ChatState } from './types';
import { api } from '../../services/api';
import type { Persona } from '../../types';

export interface PersonaSlice {
  personas: Persona[];
  activePersonaId: string | null;
  fetchPersonas: () => Promise<void>;
  createPersona: (data: { name: string; description: string; systemPrompt: string; imageUrl?: string }) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
}

export const createPersonaSlice: StateCreator<ChatState, [], [], PersonaSlice> = (set) => ({
  personas: [],
  activePersonaId: null,

  fetchPersonas: async () => {
    try {
      const res = await api.getPersonas();
      set({ personas: res.personas || [] });
    } catch (err) {
      console.error('[PersonaSlice] Failed to fetch personas:', err);
    }
  },

  createPersona: async (data) => {
    try {
      const res = await api.createPersona(data);
      if (res.persona) {
        set(state => ({
          personas: [...state.personas, res.persona],
        }));
      }
    } catch (err) {
      console.error('[PersonaSlice] Failed to create persona:', err);
      throw err;
    }
  },

  deletePersona: async (id) => {
    try {
      await api.deletePersona(id);
      set(state => ({
        personas: state.personas.filter(p => p.id !== id),
      }));
    } catch (err) {
      console.error('[PersonaSlice] Failed to delete persona:', err);
      throw err;
    }
  },
});
