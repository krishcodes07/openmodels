import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';

import { SourcesPanel } from './SourcesPanel';
import { SandboxPanel } from './SandboxPanel';
import { AuthLimitModal } from './AuthLimitModal';

export function ChatLayout() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const {
    fetchProviders,
    fetchModels,
    fetchConversations,
    loadConversation,
    selectedProviderId,
    currentConversation,
    messages,
    isSidebarOpen,
    toggleSidebar,
  } = useChatStore();

  useEffect(() => {
    fetchProviders();
    fetchModels(selectedProviderId);
    fetchConversations();

    // Auto-collapse sidebar on mobile on initial load
    if (window.innerWidth < 768 && isSidebarOpen) {
      toggleSidebar();
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  // Update document title based on the active conversation
  useEffect(() => {
    if (currentConversation?.title) {
      document.title = currentConversation.title;
    } else {
      document.title = 'OpenModels';
    }
  }, [currentConversation?.title]);

  // Navigate to /chat/:id when a new conversation is created from the homepage
  useEffect(() => {
    if (
      !conversationId &&
      currentConversation?.id &&
      !currentConversation.id.startsWith('pending-')
    ) {
      navigate(`/chat/${currentConversation.id}`);
    }
  }, [currentConversation?.id, conversationId, navigate]);

  const hasMessages = messages.length > 0 || currentConversation;

  return (
    <div className="flex h-screen h-[100dvh] bg-bg-primary overflow-hidden">
      {/* Sidebar Backdrop for Mobile */}
      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main Chat Area */}
      <main
        className="flex-1 flex flex-col min-w-0 md:min-w-[380px] transition-all duration-300"
        style={{ marginLeft: isSidebarOpen ? '0px' : '0px' }}
      >
        <ChatHeader />

        <div className="flex-1 overflow-hidden flex flex-col">
          {hasMessages ? (
            <>
              <ChatMessages />
              <ChatInput />
            </>
          ) : (
            <>
              <WelcomeScreen />
              <ChatInput />
            </>
          )}
        </div>
      </main>

      {/* Sources panel */}
      <SourcesPanel />

      {/* Sandbox Panel */}
      <SandboxPanel />

      {/* Auth limit modal */}
      <AuthLimitModal />
    </div>
  );
}
