import type { StateCreator } from 'zustand';
import type { ChatState } from './types';

export interface ThemeSlice {
  theme: 'dark' | 'light';
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  isSidebarOpen: boolean;
  toggleTheme: () => void;
  toggleThinking: () => void;
  toggleWebSearch: () => void;
  toggleSidebar: () => void;
  dismissServerKeyWarning: () => void;
}

const savedTheme = (typeof window !== 'undefined' ? localStorage.getItem('theme') : 'dark') as 'dark' | 'light' || 'dark';

// Apply on initial load if browser window is present
if (typeof window !== 'undefined') {
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

export const createThemeSlice: StateCreator<ChatState, [], [], ThemeSlice> = (set, get) => ({
  theme: savedTheme,
  thinkingEnabled: false,
  webSearchEnabled: false,
  isSidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,

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
  toggleThinking: () => set(s => ({ thinkingEnabled: !s.thinkingEnabled })),
  toggleWebSearch: () => set(s => ({ webSearchEnabled: !s.webSearchEnabled })),
  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  dismissServerKeyWarning: () => {
    set({ usingServerKey: false });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dismissedServerKeyWarning', 'true');
    }
  },
});
