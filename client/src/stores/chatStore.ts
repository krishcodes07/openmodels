import { create } from 'zustand';
import type { ChatState } from './chat/types';
import { createSandboxSlice } from './chat/sandboxSlice';
import { createThemeSlice } from './chat/themeSlice';
import { createAnonymousSlice } from './chat/anonymousSlice';
import { createModelSlice } from './chat/modelSlice';
import { createMessageSlice } from './chat/messageSlice';
import { createPersonaSlice } from './chat/personaSlice';

export const useChatStore = create<ChatState>((set, get, store) => ({
  ...createSandboxSlice(set, get, store),
  ...createThemeSlice(set, get, store),
  ...createAnonymousSlice(set, get, store),
  ...createModelSlice(set, get, store),
  ...createMessageSlice(set, get, store),
  ...createPersonaSlice(set, get, store),
}));
