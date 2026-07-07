import type { StateCreator } from 'zustand';
import type { ChatState } from './types';
import type { Conversation, Message } from '../../types';

export interface AnonymousSlice {
  anonymousConversations: Conversation[];
  anonymousMessages: Record<string, Message[]>;
  anonymousMessageCount: number;
  showAuthLimitModal: boolean;
  setShowAuthLimitModal: (show: boolean) => void;
}

const MAX_ANON_CONVERSATIONS = 20;

export function pruneAnonymousHistory(conversations: Conversation[], messages: Record<string, Message[]>) {
  if (conversations.length <= MAX_ANON_CONVERSATIONS) {
    return { conversations, messages };
  }
  const keptConversations = conversations.slice(0, MAX_ANON_CONVERSATIONS);
  const keptIds = new Set(keptConversations.map(c => c.id));

  const keptMessages: Record<string, Message[]> = {};
  for (const id in messages) {
    if (keptIds.has(id)) {
      keptMessages[id] = messages[id];
    }
  }
  return { conversations: keptConversations, messages: keptMessages };
}

const initialAnonConvs = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('anonymousConversations') || '[]') : [];
const initialAnonMsgs = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('anonymousMessages') || '{}') : {};
const initialAnonCount = typeof window !== 'undefined' ? parseInt(localStorage.getItem('anonymousMessageCount') || '0', 10) : 0;

export const createAnonymousSlice: StateCreator<ChatState, [], [], AnonymousSlice> = (set) => ({
  anonymousConversations: initialAnonConvs,
  anonymousMessages: initialAnonMsgs,
  anonymousMessageCount: initialAnonCount,
  showAuthLimitModal: false,
  setShowAuthLimitModal: (show) => set({ showAuthLimitModal: show }),
});
