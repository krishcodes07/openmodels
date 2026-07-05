import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { Send, Paperclip, Brain, Globe, Square, X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isAuthenticated } = useAuthStore();
  const {
    sendMessage,
    isStreaming,
    models,
    selectedModelId,
    thinkingEnabled,
    webSearchEnabled,
    toggleThinking,
    toggleWebSearch,
    anonymousMessageCount,
    setShowAuthLimitModal,
    currentConversation,
    stopResponse,
  } = useChatStore();

  const isLimitReached = !isAuthenticated && anonymousMessageCount >= 5;

  const currentModel = models.find(m => m.id === selectedModelId);
  const capabilities = currentModel?.capabilities;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    if (isStreaming && currentConversation?.id) {
      stopResponse(currentConversation.id);
      return;
    }
    if ((!input.trim() && imageUrls.length === 0) || uploading) return;
    sendMessage(input.trim(), imageUrls);
    setInput('');
    setImageUrls([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) {
        handleSubmit();
      }
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    // Reset input value so same files can be uploaded again
    e.target.value = '';

    setUploading(true);
    const uploadToast = toast.loading(`Uploading ${fileList.length} image(s)...`);
    try {
      const response = await api.uploadFiles(fileList);
      setImageUrls(prev => [...prev, ...response.urls]);
      toast.success('Images attached successfully', { id: uploadToast });
    } catch (err: any) {
      console.error('[Upload] Failed to upload:', err);
      toast.error(err.message || 'Failed to upload images', { id: uploadToast });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const hasContent = input.trim().length > 0 || imageUrls.length > 0;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto mb-5 md:mb-0">
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden transition-all focus-within:border-accent/25 shadow-sm">
          
          {/* Uploaded image previews */}
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-b border-border/10">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border bg-bg-tertiary">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-black/75 hover:bg-black text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="w-14 h-14 rounded-lg border border-border/30 border-dashed flex items-center justify-center bg-bg-tertiary">
                  <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                </div>
              )}
            </div>
          )}

          {/* Textarea */}
          <div className="flex items-end gap-3 px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLimitReached ? "Session limit reached. Sign up or log in to continue chatting." : "How can I help you today?"}
              disabled={isLimitReached}
              rows={1}
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted resize-none outline-none text-[15px] leading-relaxed max-h-[200px] disabled:opacity-50"
            />
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <div className="flex items-center gap-1.5">
              {/* Vision (Image Upload) capability */}
              {capabilities?.supportsVision && (
                <button
                  type="button"
                  onClick={handleFileSelect}
                  disabled={uploading || isStreaming || isLimitReached}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Attach image"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Web Search tool */}
              <button
                type="button"
                onClick={toggleWebSearch}
                disabled={isLimitReached}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  webSearchEnabled
                    ? 'text-success bg-success/10'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
                title="Web search"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Deep Think capability (only show if model supports thinking and is not a pure/always-on thinking model) */}
              {capabilities?.supportsThinking && !(selectedModelId.toLowerCase().includes('r1') || selectedModelId.toLowerCase().includes('deepseek')) && (
                <button
                  type="button"
                  onClick={toggleThinking}
                  disabled={isLimitReached}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    thinkingEnabled
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Deep Think
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!hasContent && !isStreaming) || uploading || isLimitReached}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  isStreaming
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : hasContent && !uploading && !isLimitReached
                    ? 'bg-text-primary text-text-inverse hover:opacity-80'
                    : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                }`}
                title={isStreaming ? "Stop generating" : "Send message"}
              >
                {isStreaming ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Upgrade callout if limit is reached */}
        {isLimitReached && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-accent/8 border border-accent/15 rounded-2xl mt-3 animate-fade-in shadow-glow">
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-text-primary">Unlock Unlimited Chats</span>
              <span className="text-xs text-text-secondary">You've used all 5 free messages for this session. Sign up now to save your chats and access more features.</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowAuthLimitModal(true)}
                className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 rounded-lg shadow-glow hover:shadow-lg transition-all duration-200"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-text-muted text-[10px] mt-2 opacity-60">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
