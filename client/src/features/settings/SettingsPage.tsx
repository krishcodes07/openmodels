import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Provider, ApiKeyInfo } from '../../types';
import {
  ArrowLeft,
  Key,
  Shield,
  Save,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Settings,
  BarChart3,
  Moon,
  Sun,
  Layout,
  Globe,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';

type ActiveTab = 'general' | 'apis' | 'usage';

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useChatStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);

  // General Settings State
  const [systemPrompt, setSystemPrompt] = useState('');
  const [defaultProvider, setDefaultProvider] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  // Single Provider Key State (Manage APIs)
  const [selectedKeyProvider, setSelectedKeyProvider] = useState('');
  const [singleKeyInput, setSingleKeyInput] = useState('');
  const [showSingleKey, setShowSingleKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isSavedKey, setIsSavedKey] = useState(false);

  // Web Search Provider State
  const [webSearchKeyInput, setWebSearchKeyInput] = useState('');
  const [showWebSearchKey, setShowWebSearchKey] = useState(false);
  const [isSavingWebKey, setIsSavingWebKey] = useState(false);
  const [isSavedWebKey, setIsSavedWebKey] = useState(false);

  // Usage & Analytics State
  const [usageStats, setUsageStats] = useState<any>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (providers.length > 0 && !selectedKeyProvider) {
      setSelectedKeyProvider(providers[0].id);
    }
  }, [providers, selectedKeyProvider]);

  useEffect(() => {
    if (activeTab === 'usage') {
      fetchUsage();
    }
  }, [activeTab]);

  const fetchUsage = async () => {
    setIsLoadingUsage(true);
    try {
      const data = await api.getUsageStats();
      setUsageStats(data.stats);
      setUsageLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load usage stats:', err);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const loadData = async () => {
    try {
      const [providerData, keyData, settingsData] = await Promise.all([
        api.getProviders(),
        api.getApiKeys(),
        api.getSettings().catch(() => ({ settings: null })),
      ]);
      setProviders(providerData.providers);
      setApiKeys(keyData.apiKeys);

      if (settingsData?.settings) {
        setSystemPrompt(settingsData.settings.systemPrompt || '');
        setDefaultProvider(settingsData.settings.defaultProviderId || '');
        setDefaultModel(settingsData.settings.defaultModelId || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveGeneral = async () => {
    setGeneralSaving(true);
    try {
      await api.updateSettings({
        systemPrompt: systemPrompt.trim(),
        defaultProviderId: defaultProvider || null,
        defaultModelId: defaultModel || null,
        theme,
      });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleSaveSingleKey = async () => {
    if (!selectedKeyProvider || !singleKeyInput.trim()) return;

    setIsSavingKey(true);
    try {
      await api.saveApiKey(selectedKeyProvider, singleKeyInput.trim());
      setIsSavedKey(true);
      setSingleKeyInput('');
      setTimeout(() => setIsSavedKey(false), 2000);
      loadData();
    } catch (err) {
      console.error('Failed to save key:', err);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveWebSearchKey = async () => {
    if (!webSearchKeyInput.trim()) return;
    setIsSavingWebKey(true);
    try {
      await api.saveApiKey('firecrawl', webSearchKeyInput.trim());
      setIsSavedWebKey(true);
      setWebSearchKeyInput('');
      setTimeout(() => setIsSavedWebKey(false), 2000);
      loadData();
    } catch (err) {
      console.error('Failed to save web search key:', err);
    } finally {
      setIsSavingWebKey(false);
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    try {
      await api.deleteApiKey(providerId);
      loadData();
    } catch (err) {
      console.error('Failed to delete key:', err);
    }
  };

  const isKeyConfigured = (providerId: string) => {
    return apiKeys.some(k => k.providerId === providerId);
  };

  const configuredProvidersList = providers.filter(p => isKeyConfigured(p.id));
  const activeProviderInfo = providers.find(p => p.id === selectedKeyProvider);

  return (
    <div className="h-screen bg-bg-primary text-text-primary flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-5xl w-full mx-auto px-6 py-6 md:py-8 flex-1 flex flex-col md:flex-row gap-6 md:gap-8 overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-56 flex flex-row md:flex-col gap-1 flex-shrink-0 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'general'
                ? 'bg-bg-hover text-text-primary border-l-2 border-accent'
                : 'text-text-secondary hover:bg-bg-hover/50 hover:text-text-primary'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>General</span>
          </button>
          <button
            onClick={() => setActiveTab('apis')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'apis'
                ? 'bg-bg-hover text-text-primary border-l-2 border-accent'
                : 'text-text-secondary hover:bg-bg-hover/50 hover:text-text-primary'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Manage APIs</span>
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'usage'
                ? 'bg-bg-hover text-text-primary border-l-2 border-accent'
                : 'text-text-secondary hover:bg-bg-hover/50 hover:text-text-primary'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Usage & Analytics</span>
          </button>
        </aside>

        {/* Tab Content */}
        <main className="flex-1 min-w-0 overflow-y-auto h-full pr-1 md:pr-4 pb-12">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <div>
                <h2 className="text-base font-semibold">General Settings</h2>
                <p className="text-sm text-text-secondary">Configure app preferences and LLM defaults</p>
              </div>

              {/* Theme Settings */}
              <div className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Layout className="w-4 h-4 text-accent" />
                  Appearance
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Theme Mode</p>
                    <p className="text-xs text-text-muted">Toggle between dark and light themes</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 bg-bg-tertiary border border-border hover:bg-bg-hover px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-yellow-500" />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preferences Settings */}
              <div className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-medium">Default Behavior</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      System Instruction Prompt
                    </label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="You are a helpful AI assistant..."
                      rows={4}
                      className="w-full bg-bg-tertiary border border-border rounded-lg py-2 px-3 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveGeneral}
                  disabled={generalSaving}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    generalSaved
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-accent hover:bg-accent-hover text-white disabled:opacity-40'
                  }`}
                >
                  {generalSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : generalSaved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{generalSaved ? 'Saved Settings' : 'Save Settings'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'apis' && (
            <div className="space-y-6 max-w-2xl animate-fade-in">
              <div>
                <h2 className="text-base font-semibold">Manage APIs</h2>
                <p className="text-sm text-text-secondary">Input your credentials to bypass server rate limits</p>
              </div>

              {/* API Form (Selector + Input) */}
              <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
                  <Key className="w-4 h-4 text-accent" />
                  Add or Update API Key
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                      Select Provider
                    </label>
                    <select
                      value={selectedKeyProvider}
                      onChange={(e) => {
                        setSelectedKeyProvider(e.target.value);
                        setSingleKeyInput('');
                      }}
                      className="w-full bg-bg-tertiary border border-border rounded-lg py-2.5 px-3 text-sm text-text-primary focus:outline-none focus:border-accent/30 cursor-pointer"
                    >
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input Key */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center justify-between">
                      <span>API Key</span>
                      {activeProviderInfo && isKeyConfigured(activeProviderInfo.id) && (
                        <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.2 rounded-md font-semibold">
                          Currently Configured
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showSingleKey ? 'text' : 'password'}
                        value={singleKeyInput}
                        onChange={(e) => setSingleKeyInput(e.target.value)}
                        placeholder={
                          activeProviderInfo && isKeyConfigured(activeProviderInfo.id)
                            ? '•••••••••••••••••••• (Overwrite existing)'
                            : 'Enter API Key'
                        }
                        className="w-full bg-bg-tertiary border border-border rounded-lg py-2.5 px-3 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSingleKey(!showSingleKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                      >
                        {showSingleKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSingleKey}
                    disabled={!singleKeyInput.trim() || isSavingKey}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      isSavedKey
                        ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-accent hover:bg-accent-hover text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm'
                    }`}
                  >
                    {isSavingKey ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isSavedKey ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavedKey ? 'Key Saved' : 'Save Key'}</span>
                  </button>
                </div>
              </div>

              {/* Configured API Keys List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Configured API Keys
                </h3>

                {configuredProvidersList.length === 0 ? (
                  <div className="text-center py-6 bg-bg-secondary border border-border border-dashed rounded-xl text-xs text-text-muted">
                    No custom API keys configured. Server rate limits will apply.
                  </div>
                ) : (
                  <div className="bg-bg-secondary border border-border rounded-xl divide-y divide-border/60 overflow-hidden shadow-sm">
                    {configuredProvidersList.map(provider => (
                      <div
                        key={provider.id}
                        className="flex items-center justify-between p-4 hover:bg-bg-hover/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-accent">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-text-primary">
                              {provider.name}
                            </div>
                            <div className="text-xs text-text-secondary font-mono mt-0.5">
                              ••••••••••••••••••••
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] text-success bg-success/10 px-2 py-1 rounded-lg font-semibold select-none">
                            <Shield className="w-3 h-3" />
                            Active
                          </span>
                          <button
                            onClick={() => handleDeleteKey(provider.id)}
                            className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-error transition-colors cursor-pointer"
                            title="Remove Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Web Search Providers */}
              <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
                  <Globe className="w-4 h-4 text-success" />
                  Web Search Provider
                </h3>
                <p className="text-xs text-text-secondary -mt-2">
                  Configure a web search provider to enable AI-powered search with real page scraping. Currently supports Firecrawl.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center justify-between">
                      <span>Firecrawl API Key</span>
                      {isKeyConfigured('firecrawl') && (
                        <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-md font-semibold">
                          Configured
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showWebSearchKey ? 'text' : 'password'}
                        value={webSearchKeyInput}
                        onChange={(e) => setWebSearchKeyInput(e.target.value)}
                        placeholder={
                          isKeyConfigured('firecrawl')
                            ? '•••••••••••••••••••• (Overwrite existing)'
                            : 'fc-your-firecrawl-api-key'
                        }
                        className="w-full bg-bg-tertiary border border-border rounded-lg py-2.5 px-3 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebSearchKey(!showWebSearchKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                      >
                        {showWebSearchKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-text-muted">
                      Get your API key at{' '}
                      <a href="https://www.firecrawl.dev/app/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        firecrawl.dev
                      </a>
                    </p>
                    <div className="flex items-center gap-2">
                      {isKeyConfigured('firecrawl') && (
                        <button
                          onClick={() => handleDeleteKey('firecrawl')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-error hover:bg-error/5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                      <button
                        onClick={handleSaveWebSearchKey}
                        disabled={!webSearchKeyInput.trim() || isSavingWebKey}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSavedWebKey
                            ? 'bg-success/10 text-success border border-success/20'
                            : 'bg-accent hover:bg-accent-hover text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm'
                        }`}
                      >
                        {isSavingWebKey ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isSavedWebKey ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{isSavedWebKey ? 'Saved' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Encryption Notice */}
              <div className="bg-bg-secondary border border-border rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">End-to-End Key Security</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Your credentials are AES-256-GCM encrypted immediately upon receipt. We only load them dynamically into memory for authentication during active query executions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-6 max-w-3xl animate-fade-in">
              <div>
                <h2 className="text-base font-semibold">Usage & Analytics</h2>
                <p className="text-sm text-text-secondary">Monitor your prompt history and token metrics</p>
              </div>

              {isLoadingUsage ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted space-y-3">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs">Loading analytics data...</p>
                </div>
              ) : !usageStats ? (
                <div className="text-center py-8 bg-bg-secondary border border-border border-dashed rounded-xl text-xs text-text-muted">
                  No usage data recorded yet. Send some messages to compile metrics!
                </div>
              ) : (
                <>
                  {/* Grid of stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-bg-secondary border border-border rounded-xl p-5 shadow-sm">
                      <p className="text-xs text-text-secondary font-medium">Total Tokens Spent</p>
                      <h3 className="text-2xl font-bold mt-2 tabular-nums">
                        {usageStats.totalTokensSpent.toLocaleString()}
                      </h3>
                      <p className="text-xs text-text-muted mt-1">Across all models & providers</p>
                    </div>
                    <div className="bg-bg-secondary border border-border rounded-xl p-5 shadow-sm">
                      <p className="text-xs text-text-secondary font-medium">Total Chat Sessions</p>
                      <h3 className="text-2xl font-bold mt-2 tabular-nums">
                        {usageStats.totalChats}
                      </h3>
                      <p className="text-xs text-text-muted mt-1">Active conversation threads</p>
                    </div>
                    <div className="bg-bg-secondary border border-border rounded-xl p-5 shadow-sm">
                      <p className="text-xs text-text-secondary font-medium">Web Search Invocations</p>
                      <h3 className="text-2xl font-bold mt-2 tabular-nums">
                        {usageStats.totalWebSearches}
                      </h3>
                      <p className="text-xs text-text-muted mt-1">Sources consulted and cited</p>
                    </div>
                  </div>

                  {/* Token Distribution by Provider & Model */}
                  <div className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold">Token Distribution by Provider</h3>
                      <BarChart3 className="w-4 h-4 text-accent" />
                    </div>

                    {Object.keys(usageStats.providerStats).length === 0 ? (
                      <div className="h-24 flex items-center justify-center text-xs text-text-muted">
                        No provider-specific metrics compiled.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(usageStats.providerStats).map(([providerId, stat]: [string, any]) => {
                          const providerName = providers.find(p => p.id === providerId)?.name || providerId.toUpperCase();
                          const percent = usageStats.totalTokensSpent > 0 
                            ? Math.round((stat.total / usageStats.totalTokensSpent) * 100) 
                            : 0;

                          return (
                            <div key={providerId} className="space-y-2.5">
                              {/* Provider Row */}
                              <div className="flex justify-between items-end">
                                <div>
                                  <span className="text-sm font-bold text-text-primary capitalize">{providerName}</span>
                                  <span className="text-[10px] text-text-muted ml-2 font-mono">{stat.total.toLocaleString()} tokens</span>
                                </div>
                                <span className="text-xs font-semibold text-accent">{percent}%</span>
                              </div>

                              {/* Progress bar container */}
                              <div className="h-2 w-full bg-bg-tertiary rounded-full overflow-hidden border border-border/20">
                                <div
                                  className="h-full bg-accent rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              {/* Model breakdown list */}
                              <div className="pl-3 border-l border-border/60 space-y-1.5 mt-2">
                                {Object.entries(stat.models).map(([modelId, tokenCount]: [string, any]) => (
                                  <div key={modelId} className="flex justify-between text-xs text-text-secondary font-mono">
                                    <span className="truncate max-w-[70%]">{modelId}</span>
                                    <span>{tokenCount.toLocaleString()} tkn</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Usage Logs History */}
                  <div className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4 shadow-sm overflow-hidden">
                    <h3 className="text-sm font-semibold">Recent Usage Logs</h3>
                    {usageLogs.length === 0 ? (
                      <div className="text-center py-6 text-xs text-text-muted">
                        No usage log records found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-text-secondary whitespace-nowrap">
                          <thead>
                            <tr className="border-b border-border text-[10px] uppercase font-bold text-text-muted tracking-wider">
                              <th className="pb-3 pr-4 font-semibold">Time</th>
                              <th className="pb-3 px-4 font-semibold">Provider</th>
                              <th className="pb-3 px-4 font-semibold">Model</th>
                              <th className="pb-3 px-4 font-semibold text-right">Prompt</th>
                              <th className="pb-3 px-4 font-semibold text-right">Completion</th>
                              <th className="pb-3 pl-4 font-semibold text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {usageLogs.map((log) => {
                              const timeString = new Date(log.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              });

                              return (
                                <tr key={log.id} className="hover:bg-bg-hover/10 transition-colors">
                                  <td className="py-2.5 pr-4 text-text-muted">{timeString}</td>
                                  <td className="py-2.5 px-4 font-sans font-semibold capitalize text-text-primary">
                                    {log.providerId}
                                  </td>
                                  <td className="py-2.5 px-4 truncate max-w-[150px]">{log.modelId}</td>
                                  <td className="py-2.5 px-4 text-right">{log.promptTokens.toLocaleString()}</td>
                                  <td className="py-2.5 px-4 text-right">{log.completionTokens.toLocaleString()}</td>
                                  <td className="py-2.5 pl-4 text-right font-bold text-text-primary">
                                    {log.totalTokens.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
