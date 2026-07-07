import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { ChevronDown, PanelLeft, Sun, Moon, X, AlertTriangle, Settings, Search, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ChatHeader() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    providers,
    currentConversation,
    activePersonaId,
    personas,
    models,
    selectedProviderId,
    selectedModelId,
    selectProvider,
    selectModel,
    toggleSidebar,
    isSidebarOpen,
    theme,
    toggleTheme,
    usingServerKey,
    dismissServerKeyWarning,
  } = useChatStore();

  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');

  const providerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const currentProvider = providers.find(p => p.id === selectedProviderId);
  const currentModel = models.find(m => m.id === selectedModelId);
  const activePersona = currentConversation?.persona ||
    (activePersonaId ? personas.find(p => p.id === activePersonaId) : null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredProviders = providers.filter(p =>
    p.name.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <>
      <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-bg-primary/90 backdrop-blur-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-1 text-sm font-medium">
          {/* Sidebar toggle */}
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors mr-1"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          {/* Active Persona Badge */}
          {activePersona && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-accent/8 border border-accent/15 mr-1.5 animate-fade-in select-none" title={`Active Persona: ${activePersona.name}`}>
              <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[10px] overflow-hidden">
                {activePersona.imageUrl ? (
                  <img src={activePersona.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[8px] font-bold text-accent">
                    {activePersona.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-accent truncate max-w-[80px] sm:max-w-[120px]">{activePersona.name}</span>
            </div>
          )}

          {/* Provider Selection */}
          <div className="relative" ref={providerRef}>
            <button
              onClick={() => {
                setShowProviderDropdown(!showProviderDropdown);
                setShowModelDropdown(false);
                setProviderSearch('');
              }}
              className="flex items-center gap-0.5 px-1 py-0.5 sm:px-2 sm:py-1 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors font-semibold"
            >
              <span className="max-w-[70px] sm:max-w-[120px] md:max-w-none truncate">{currentProvider?.name || 'Select Provider'}</span>
              <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
            </button>

            {showProviderDropdown && (
              <div className="fixed sm:absolute top-12 sm:top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-1.5 w-[92vw] sm:w-64 max-w-[340px] sm:max-w-none bg-bg-secondary border border-border rounded-xl shadow-lg z-50 animate-fade-in overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                    <input
                      type="text"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Search providers..."
                      className="w-full bg-bg-tertiary border border-border rounded-lg py-1 pl-7 pr-2.5 text-xs focus:outline-none focus:border-accent/30"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredProviders.length === 0 ? (
                    <div className="text-center py-4 text-xs text-text-muted">No providers found</div>
                  ) : (
                    filteredProviders.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          selectProvider(p.id);
                          setShowProviderDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-hover transition-colors flex items-center justify-between ${
                          p.id === selectedProviderId ? 'bg-accent/8 text-accent font-medium' : 'text-text-primary'
                        }`}
                      >
                        <div>
                          <div>{p.name}</div>
                          <div className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{p.description}</div>
                        </div>
                        {p.id === selectedProviderId && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-text-muted mx-0.5" />

          {/* Model Selection */}
          <div className="relative" ref={modelRef}>
            <button
              onClick={() => {
                setShowModelDropdown(!showModelDropdown);
                setShowProviderDropdown(false);
                setModelSearch('');
              }}
              className="flex items-center gap-0.5 px-1 py-0.5 sm:px-2 sm:py-1 rounded-lg hover:bg-bg-hover text-text-primary transition-colors font-medium"
              disabled={models.length === 0}
            >
              <span className="max-w-[80px] sm:max-w-[150px] md:max-w-none truncate">
                {currentModel?.name || (selectedModelId ? selectedModelId.split('/').pop() : 'Loading...')}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
            </button>

            {showModelDropdown && (
              <div className="fixed sm:absolute top-12 sm:top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 sm:right-auto mt-1.5 w-[92vw] sm:w-72 max-w-[340px] sm:max-w-none bg-bg-secondary border border-border rounded-xl shadow-lg z-50 animate-fade-in overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Search models..."
                      className="w-full bg-bg-tertiary border border-border rounded-lg py-1 pl-7 pr-2.5 text-xs focus:outline-none focus:border-accent/30"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-4 text-xs text-text-muted">No models found</div>
                  ) : (
                    filteredModels.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          selectModel(m.id);
                          setShowModelDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-bg-hover transition-colors ${
                          m.id === selectedModelId ? 'bg-accent/8' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${m.id === selectedModelId ? 'text-accent font-medium' : 'text-text-primary'}`}>
                            {m.name}
                          </span>
                          {m.contextLength && (
                            <span className="text-[9px] text-text-muted font-mono">
                              {(m.contextLength / 1024).toFixed(0)}K
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{m.description}</p>
                        )}
                        {(m.capabilities.supportsVision || m.capabilities.supportsThinking) && (
                          <div className="flex gap-1 mt-1">
                            {m.capabilities.supportsVision && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-info/10 text-info font-semibold">Vision</span>
                            )}
                            {m.capabilities.supportsThinking && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-accent/10 text-accent font-semibold">Thinking</span>
                            )}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {!isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/auth?mode=login')}
                className="px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-hover border border-border transition-all duration-200"
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="hidden sm:inline-block px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 rounded-lg shadow-glow hover:shadow-lg transition-all duration-200"
              >
                Sign Up
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Server API Key Banner */}
      {usingServerKey && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-warning/8 border-b border-warning/15 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <p className="text-xs text-warning">
              Using server API key — may be rate-limited.{' '}
              <button
                onClick={() => navigate('/settings')}
                className="underline hover:no-underline font-medium"
              >
                Add your own key
              </button>
            </p>
          </div>
          <button onClick={dismissServerKeyWarning} className="text-warning/60 hover:text-warning">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
