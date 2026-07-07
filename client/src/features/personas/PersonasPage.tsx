import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { Sidebar } from '../sidebar/Sidebar';
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  Check,
  User,
  ShieldAlert,
  Upload,
  Edit2,
  PanelLeft,
  Search,
  X,
  Wand2,
  Bot,
  LayoutGrid,
} from 'lucide-react';

export function PersonasPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    personas,
    fetchPersonas,
    createPersona,
    deletePersona,
    createNewChat,
    isSidebarOpen,
    toggleSidebar,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<'built-in' | 'custom'>('built-in');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const builtInPersonas = personas.filter(p => !p.userId);
  const customPersonas = personas.filter(p => !!p.userId);

  // Extract unique categories from built-in personas
  const categories = useMemo(() => {
    const cats = builtInPersonas
      .map(p => p.category)
      .filter((c): c is string => !!c && c.trim() !== '');
    return ['All', ...Array.from(new Set(cats))];
  }, [builtInPersonas]);

  const filteredBuiltIn = useMemo(() => {
    let result = builtInPersonas;

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [builtInPersonas, selectedCategory, searchQuery]);

  const filteredCustom = useMemo(() => {
    if (!searchQuery.trim()) return customPersonas;
    const q = searchQuery.toLowerCase();
    return customPersonas.filter(
      p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [customPersonas, searchQuery]);

  const handleCreatePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !systemPrompt.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await createPersona({
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        imageUrl: imageUrl.trim(),
      });
      setName('');
      setDescription('');
      setSystemPrompt('');
      setImageUrl('');
      setIsCreating(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create persona.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this custom persona?')) {
      try {
        await deletePersona(id);
      } catch (err) {
        alert('Failed to delete persona.');
      }
    }
  };

  const handleStartChat = (personaId: string) => {
    createNewChat(personaId);
    navigate('/');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;

        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setImageUrl(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const renderPersonaAvatar = (url: string | null | undefined, name: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-10 h-10 rounded-xl text-xs',
      md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-sm sm:text-base',
      lg: 'w-20 h-20 sm:w-24 sm:h-24 rounded-full text-lg sm:text-xl',
    };

    if (!url) {
      return (
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/30 flex items-center justify-center text-accent font-bold shadow-inner select-none transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow flex-shrink-0`}>
          {name.substring(0, 2).toUpperCase()}
        </div>
      );
    }

    return (
      <div className={`${sizeClasses[size]} bg-bg-elevated border border-border/50 flex items-center justify-center overflow-hidden shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg flex-shrink-0 ring-2 ring-transparent group-hover:ring-accent/30`}>
        <img src={url} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  };

  const renderLayout = (content: React.ReactNode) => {
    return (
      <div className="flex h-screen h-[100dvh] bg-bg-primary overflow-hidden w-full">
        {isSidebarOpen && (
          <div
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-200"
          />
        )}
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          {content}
        </main>
      </div>
    );
  };

  if (isCreating) {
    return renderLayout(
      <>
        <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2 sm:gap-4">
            {!isSidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer mr-1"
                title="Open Sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsCreating(false)}
              className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                Create Custom Persona
              </h1>
              <p className="text-[10px] sm:text-xs text-text-muted mt-0.5">Define custom instructions to shape assistant responses.</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <form
            onSubmit={handleCreatePersona}
            className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-20 animate-fade-in"
          >
            {error && (
              <div className="p-3 text-xs bg-error/10 text-error rounded-xl border border-error/20 flex items-center gap-2">
                <X className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Avatar Upload */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                />
                {imageUrl ? (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-accent/40 overflow-hidden shadow-lg group-hover:border-accent transition-all duration-200">
                    <img src={imageUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-dashed border-border/80 flex flex-col items-center justify-center group-hover:border-accent group-hover:bg-accent/5 transition-all duration-200 bg-bg-secondary">
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-text-muted mb-1" />
                    <span className="text-[9px] sm:text-[10px] text-text-muted font-semibold">Upload Photo</span>
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 bg-accent rounded-full border-2 border-bg-primary flex items-center justify-center text-white shadow-md z-20 transition-transform group-hover:scale-110">
                  <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
              </div>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-[10px] text-error hover:underline mt-2 animate-fade-in"
                >
                  Remove image
                </button>
              )}
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="block text-xs sm:text-sm font-semibold text-text-primary">
                  Character Name
                </label>
                <span className={`text-[9px] sm:text-[10px] font-mono ${name.length >= 18 ? 'text-warning' : 'text-text-muted'}`}>{name.length}/20</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 20))}
                placeholder="e.g. Albert Einstein"
                className="w-full bg-bg-secondary border border-border hover:border-border-hover focus:border-accent/40 rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-text-primary focus:outline-none transition-all placeholder:text-text-muted"
                required
              />
            </div>

            {/* Tagline */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-text-primary">
                    Tagline
                  </label>
                  <p className="text-[10px] sm:text-[11px] text-text-muted mt-0.5">
                    Short description shown in the gallery.
                  </p>
                </div>
                <span className={`text-[9px] sm:text-[10px] font-mono ${description.length >= 70 ? 'text-warning' : 'text-text-muted'}`}>{description.length}/80</span>
              </div>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 80))}
                placeholder="A detective who solves crimes... before they happen."
                className="w-full bg-bg-secondary border border-border hover:border-border-hover focus:border-accent/40 rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-text-primary focus:outline-none transition-all placeholder:text-text-muted"
                required
              />
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-text-primary">
                    System Instructions
                  </label>
                  <p className="text-[10px] sm:text-[11px] text-text-muted mt-0.5">
                    Detailed personality and behavior instructions for the AI.
                  </p>
                </div>
                <span className={`text-[9px] sm:text-[10px] font-mono ${systemPrompt.length >= 900 ? 'text-warning' : 'text-text-muted'}`}>{systemPrompt.length}/1000</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value.slice(0, 1000))}
                placeholder="Roleplay as Albert Einstein. Speak with humble wisdom, focus on physics, curiosity, and peaceful dialogue..."
                rows={6}
                className="w-full bg-bg-secondary border border-border hover:border-border-hover focus:border-accent/40 rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-text-primary focus:outline-none transition-all placeholder:text-text-muted resize-none font-mono leading-relaxed"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-xl border border-border transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim() || !description.trim() || !systemPrompt.trim()}
                className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl shadow-glow transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Create Persona</span>
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  // Gallery View
  return renderLayout(
    <>
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2 sm:gap-4">
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer mr-1"
              title="Open Sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
              AI Personas
            </h1>
            <p className="text-[10px] sm:text-xs text-text-muted mt-0.5">Choose a persona to customize AI behavior.</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col overflow-hidden">
        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 flex-shrink-0">
          <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
            <button
              onClick={() => setActiveTab('built-in')}
              className={`relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'built-in'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                Pre-Built
              </span>
              
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                My Personas
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search personas..."
                className="w-full sm:w-48 bg-bg-secondary border border-border hover:border-border-hover focus:border-accent/40 rounded-xl py-1.5 sm:py-2 pl-8 pr-3 text-xs text-text-primary focus:outline-none transition-all placeholder:text-text-muted"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Create Button */}
            {activeTab === 'custom' && isAuthenticated && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1 bg-accent hover:bg-accent-hover text-white text-[10px] sm:text-xs font-bold px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shadow-glow transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Create</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filters (only for built-in tab) */}
        {activeTab === 'built-in' && categories.length > 1 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0 scrollbar-none">
            <LayoutGrid className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-1 pb-12">
          {activeTab === 'built-in' && (
            <div className="animate-fade-in">
              {filteredBuiltIn.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Search className="w-10 h-10 text-text-muted/40 mb-3" />
                  <p className="text-sm text-text-muted">No personas found {searchQuery ? `matching "${searchQuery}"` : `in "${selectedCategory}"`}</p>
                  {(searchQuery || selectedCategory !== 'All') && (
                    <button
                      onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                      className="mt-2 text-xs text-accent hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                  {filteredBuiltIn.map((persona, i) => (
                    <div
                      key={persona.id}
                      onClick={() => handleStartChat(persona.id)}
                      className="group relative flex flex-col p-4 sm:p-5 rounded-2xl bg-bg-secondary/60 backdrop-blur-sm border border-border/50 hover:border-accent/40 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {/* Subtle gradient overlay on hover */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                      <div className="relative flex items-start gap-3 sm:gap-4">
                        {renderPersonaAvatar(persona.imageUrl, persona.name)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                              {persona.name}
                            </h3>
                            {persona.category && (
                              <span className="text-[8px] font-bold text-accent bg-accent/15 px-1.5 py-0.5 rounded-md flex-shrink-0 select-none">
                                {persona.category}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-text-muted mt-0.5">By OpenModels</p>
                        </div>
                      </div>

                      <p className="relative text-xs text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                        {persona.description}
                      </p>

                      <div className="relative mt-4 flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Start Chat</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'custom' && (
            <>
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/15 to-purple-500/15 border border-accent/20 flex items-center justify-center text-accent">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Unlock Custom Personas</h3>
                    <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                      Sign in to create, customize, and manage your own AI personas with unique system instructions.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/auth')}
                    className="w-full bg-accent hover:bg-accent-hover text-white text-xs font-bold py-2.5 rounded-xl shadow-glow transition-all cursor-pointer"
                  >
                    Log In / Sign Up
                  </button>
                </div>
              ) : customPersonas.length === 0 && !searchQuery ? (
                <div
                  onClick={() => setIsCreating(true)}
                  className="flex flex-col items-center justify-center p-12 sm:p-16 text-center border-2 border-dashed border-border/80 hover:border-accent/40 rounded-2xl cursor-pointer hover:bg-bg-secondary/40 transition-all duration-300 group animate-fade-in"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/15 to-purple-500/15 flex items-center justify-center text-accent group-hover:scale-110 group-hover:shadow-glow transition-all duration-300">
                    <Plus className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-text-primary mt-5">Create Your First Persona</h3>
                  <p className="text-xs text-text-muted mt-2 max-w-xs leading-relaxed">
                    Design a custom AI persona with unique personality, tone, and expertise to make conversations more engaging.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-accent group-hover:translate-x-1 transition-transform">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Get Started</span>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  {filteredCustom.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Search className="w-10 h-10 text-text-muted/40 mb-3" />
                      <p className="text-sm text-text-muted">No personas found matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCustom.map((persona, i) => (
                        <div
                          key={persona.id}
                          onClick={() => handleStartChat(persona.id)}
                          className="group relative flex flex-col p-4 sm:p-5 rounded-2xl bg-bg-secondary/60 backdrop-blur-sm border border-border/50 hover:border-accent/40 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                          <button
                            onClick={(e) => handleDelete(persona.id, e)}
                            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer z-10"
                            title="Delete Persona"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="relative flex items-start gap-3 sm:gap-4">
                            {renderPersonaAvatar(persona.imageUrl, persona.name)}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                                  {persona.name}
                                </h3>
                                <span className="text-[8px] font-bold text-text-secondary bg-bg-hover border border-border px-1.5 py-0.5 rounded-md flex-shrink-0 select-none flex items-center gap-0.5">
                                  <User className="w-2.5 h-2.5" />
                                  Custom
                                </span>
                              </div>
                              <p className="text-[10px] text-text-muted mt-0.5">By You</p>
                            </div>
                          </div>

                          <p className="relative text-xs text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                            {persona.description}
                          </p>

                          <div className="relative mt-4 flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Start Chat</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
