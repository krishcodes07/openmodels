import type { StateCreator } from 'zustand';
import type { ChatState } from './types';

export interface SandboxSlice {
  activeSandboxCode: string | null;
  activeSandboxOriginalCode: string | null;
  activeSandboxLanguage: string | null;
  isSandboxOpen: boolean;
  openSandbox: (code: string, language: string) => void;
  updateSandboxCode: (code: string) => void;
  closeSandbox: () => void;
  resetSandboxCode: () => void;
}

export const createSandboxSlice: StateCreator<ChatState, [], [], SandboxSlice> = (set) => ({
  activeSandboxCode: null,
  activeSandboxOriginalCode: null,
  activeSandboxLanguage: null,
  isSandboxOpen: false,

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
});
