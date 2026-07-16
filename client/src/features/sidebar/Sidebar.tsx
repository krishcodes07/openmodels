import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Plus,
  Search,
  MessageSquare,
  Settings,
  LogOut,
  Trash2,
  Edit3,
  Check,
  X,
  PanelLeft,
  Pin,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    conversations,
    currentConversation,
    isSidebarOpen,
    createNewChat,
    deleteConversation,
    renameConversation,
    toggleSidebar,
    togglePinConversation,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [width, setWidth] = useState(() => Number(localStorage.getItem('sidebarWidth')) || 256);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);

      if (window.innerWidth >= 768) {
        const activeSandboxOpen = useChatStore.getState().isSandboxOpen && useChatStore.getState().activeSandboxCode !== null;
        const otherWidth = activeSandboxOpen ? (Number(localStorage.getItem('sandboxWidth')) || Math.min(600, Math.floor(window.innerWidth * 0.5))) : 0;
        const maxAllowedWidth = Math.max(200, window.innerWidth - otherWidth - 380);
        if (width > maxAllowedWidth) {
          const newW = Math.max(200, maxAllowedWidth);
          setWidth(newW);
          localStorage.setItem('sidebarWidth', String(newW));
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const activeSandboxOpen = useChatStore.getState().isSandboxOpen && useChatStore.getState().activeSandboxCode !== null;
      const otherWidth = activeSandboxOpen ? (Number(localStorage.getItem('sandboxWidth')) || Math.min(600, Math.floor(window.innerWidth * 0.5))) : 0;
      const maxAllowedWidth = Math.max(200, window.innerWidth - otherWidth - 380);
      const limitWidth = Math.min(450, maxAllowedWidth);

      const newWidth = startWidth + (moveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= limitWidth) {
        setWidth(newWidth);
        localStorage.setItem('sidebarWidth', String(newWidth));
      } else if (newWidth > limitWidth) {
        setWidth(limitWidth);
        localStorage.setItem('sidebarWidth', String(limitWidth));
      } else if (newWidth < 200) {
        setWidth(200);
        localStorage.setItem('sidebarWidth', String(200));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const sidebarStyle = !isMobile
    ? {
        width: isSidebarOpen ? `${width}px` : '0px',
      }
    : undefined;

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConvs = filteredConversations.filter(c => c.isPinned);
  const unpinnedConvs = filteredConversations.filter(c => !c.isPinned);

  const handleNewChat = () => {
    createNewChat();
    navigate('/');
  };

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleStartRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleConfirmRename = (id: string) => {
    if (editTitle.trim()) {
      renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const renderConvItem = (conv: typeof conversations[0]) => {
    return (
      <div
        key={conv.id}
        onMouseEnter={() => setHoveredId(conv.id)}
        onMouseLeave={() => setHoveredId(null)}
        className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-100 ${
          currentConversation?.id === conv.id
            ? 'bg-bg-hover text-text-primary'
            : 'hover:bg-bg-hover/50 text-text-secondary hover:text-text-primary'
        }`}
        onClick={() => {
          if (editingId !== conv.id) {
            handleSelectConversation(conv.id);
          }
        }}
      >
        {editingId === conv.id ? (
          <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename(conv.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="flex-1 bg-bg-tertiary text-xs rounded px-2 py-1 outline-none border border-accent/25"
              autoFocus
            />
            <button onClick={() => handleConfirmRename(conv.id)} className="p-0.5">
              <Check className="w-3 h-3 text-success" />
            </button>
            <button onClick={() => setEditingId(null)} className="p-0.5">
              <X className="w-3 h-3 text-text-muted" />
            </button>
          </div>
        ) : (
          <>
            {conv.persona ? (
              <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-xs flex-shrink-0 overflow-hidden">
                {conv.persona.imageUrl ? (
                  <img src={conv.persona.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-accent">
                    {conv.persona.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            ) : (
              <MessageSquare className="w-4 h-4 text-text-muted/60 flex-shrink-0" />
            )}
            <span className="flex-1 text-[13px] truncate">{conv.title}</span>

            {(hoveredId === conv.id || currentConversation?.id === conv.id) && (
              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Pin button */}
                <button
                  onClick={() => togglePinConversation(conv.id)}
                  className="p-1 rounded hover:bg-bg-active transition-colors animate-fade-in"
                  title={conv.isPinned ? "Unpin chat" : "Pin chat"}
                >
                  <Pin className={`w-3 h-3 ${conv.isPinned ? 'text-accent fill-accent/20' : 'text-text-muted hover:text-text-primary'}`} />
                </button>
                {/* Rename button */}
                <button
                  onClick={() => handleStartRename(conv.id, conv.title)}
                  className="p-1 rounded hover:bg-bg-active transition-colors animate-fade-in"
                  title="Rename chat"
                >
                  <Edit3 className="w-3 h-3 text-text-muted hover:text-text-primary" />
                </button>
                {/* Delete button */}
                <button
                  onClick={() => deleteConversation(conv.id)}
                  className="p-1 rounded hover:bg-bg-active transition-colors animate-fade-in"
                  title="Delete chat"
                >
                  <Trash2 className="w-3 h-3 text-text-muted hover:text-error" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      style={sidebarStyle}
      className={`flex flex-col bg-bg-secondary border-r border-border h-full select-none flex-shrink-0 shadow-2xl md:shadow-none
        fixed z-40 top-0 left-0 md:relative md:top-auto md:left-auto md:z-0
        ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:overflow-hidden'}
        ${isMobile ? (isSidebarOpen ? 'w-64' : 'w-64') : ''}
      `}
    >
      {/* Drag handle */}
      {isSidebarOpen && !isMobile && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 -right-1 w-2 h-full cursor-col-resize z-50 select-none group flex justify-center"
        >
          <div className={`w-[2px] h-full transition-colors duration-150 ${isDragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/40'}`} />
        </div>
      )}

      {/* Full screen resize overlay */}
      {isDragging && (
        <div className="fixed inset-0 cursor-col-resize z-[9999] select-none pointer-events-auto" />
      )}
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleNewChat}
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      {/* Personas Entry Point */}
      <div className="px-2 mb-2">
        <button
          onClick={() => navigate('/personas')}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-accent/10 to-purple-500/10 hover:from-accent/15 hover:to-purple-500/15 border border-accent/20 hover:border-accent/30 text-accent transition-all duration-200"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore Personas</span>
          </div>
          <ChevronRight className="w-3 h-3 opacity-60" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 mb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-bg-tertiary border border-border rounded-lg py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/25 transition-colors"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-6 h-6 text-text-muted mx-auto mb-2 opacity-20" />
            <p className="text-text-muted text-xs">
              {searchQuery ? 'No results' : 'No conversations'}
            </p>
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedConvs.length > 0 && (
              <div className="space-y-px">
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider select-none flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-accent fill-accent/20 rotate-45" />
                  <span>Pinned</span>
                </div>
                {pinnedConvs.map(conv => renderConvItem(conv))}
              </div>
            )}

            {/* Recent Section */}
            <div className="space-y-px">
              {pinnedConvs.length > 0 && unpinnedConvs.length > 0 && (
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider select-none">
                  Recent
                </div>
              )}
              {unpinnedConvs.map(conv => renderConvItem(conv))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2">
        {user ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-medium text-text-secondary">
                  {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {user.name || 'User'}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => navigate('/settings')}
                className="p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-error transition-colors"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-2 rounded-xl bg-bg-tertiary/40 border border-border/60 animate-fade-in">
            <div className="text-[11px] text-text-secondary leading-relaxed font-medium">
              Sign in to save your conversation history.
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('/auth?mode=login')}
                className="flex-1 py-1 px-2.5 text-[11px] font-semibold text-center text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-hover transition-all duration-200"
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="flex-1 py-1 px-2.5 text-[11px] font-semibold text-center text-white bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 rounded-lg shadow-glow hover:shadow-lg transition-all duration-200"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
