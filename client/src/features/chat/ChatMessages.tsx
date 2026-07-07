import { useEffect, useRef, useState, useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { Brain, Sparkles, ChevronUp, ChevronDown, Copy, Check, RefreshCw, ChevronLeft, ChevronRight, Globe, Play, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function ChatMessages() {
  const {
    messages,
    isStreaming,
    streamingContent,
    thinkingContent,
    activeVersionMap,
    regeneratingMessageId,
    activeSources,
    currentConversation,
    personas,
    activePersonaId,
  } = useChatStore();

  // Resolve the active persona's image URL
  const personaImageUrl = useMemo(() => {
    // First check activePersonaId (for new chats before conversation is created)
    if (activePersonaId) {
      const persona = personas.find(p => p.id === activePersonaId);
      if (persona?.imageUrl) return persona.imageUrl;
    }
    // Then check current conversation's linked persona
    if (currentConversation?.persona?.imageUrl) {
      return currentConversation.persona.imageUrl;
    }
    return null;
  }, [activePersonaId, personas, currentConversation]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const lastMessagesLengthRef = useRef(messages.length);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    shouldAutoScrollRef.current = true;
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      // Sync last scroll top reference
      lastScrollTopRef.current = container.scrollHeight - container.clientHeight;
    }
  };

  useEffect(() => {
    // If a new message is added (e.g. user sends one), override manual lock and scroll to bottom
    if (messages.length > lastMessagesLengthRef.current) {
      shouldAutoScrollRef.current = true;
      scrollToBottom('smooth');
    } else if (shouldAutoScrollRef.current) {
      scrollToBottom('smooth');
    }
    lastMessagesLengthRef.current = messages.length;
  }, [messages, streamingContent, thinkingContent]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;

    // Detect if user is scrolling up (scrollTop decreased)
    if (currentScrollTop < lastScrollTopRef.current) {
      shouldAutoScrollRef.current = false;
    }

    // Detect if user scrolled manually back to the bottom
    const threshold = 50;
    const isAtBottom = container.scrollHeight - currentScrollTop - container.clientHeight <= threshold;
    if (isAtBottom) {
      shouldAutoScrollRef.current = true;
    }

    lastScrollTopRef.current = currentScrollTop;
    setShowScrollButton(!isAtBottom);
  };

  // Group messages: each group represents a USER message and its associated ASSISTANT response versions
  const userMessages = messages.filter(m => m.role === 'USER');
  const assistantMessages = messages.filter(m => m.role === 'ASSISTANT');
  const systemMessages = messages.filter(m => m.role === 'SYSTEM');

  const groups: { userMessage: Message; responses: Message[] }[] = [];
  const processedAssistantIds = new Set<string>();

  userMessages.forEach(userMsg => {
    // Find assistant responses that list this user prompt as their parent
    let responses = assistantMessages.filter(m => m.parentMessageId === userMsg.id);
    if (responses.length === 0) {
      // chronologically next message in the list
      const idx = messages.findIndex(m => m.id === userMsg.id);
      if (idx !== -1 && messages[idx + 1]?.role === 'ASSISTANT') {
        responses = [messages[idx + 1]];
      }
    }
    responses.forEach(r => processedAssistantIds.add(r.id));
    groups.push({
      userMessage: userMsg,
      responses,
    });
  });

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="max-w-3xl mx-auto space-y-6">
        {/* Render system messages if any */}
        {systemMessages.map(m => (
          <MessageBubble key={m.id} role="SYSTEM" content={m.content} />
        ))}

        {/* Render groups */}
        {groups.map((group) => {
          const userMsg = group.userMessage;
          const responses = group.responses;

          // Find active response
          const activeResponseId = activeVersionMap[userMsg.id];
          const activeResponseIdx = Math.max(0, responses.findIndex(r => r.id === activeResponseId));
          const activeResponse = responses[activeResponseIdx] || responses[responses.length - 1];

          const isThisMsgRegenerating = isStreaming && regeneratingMessageId === userMsg.id;

          return (
            <div key={userMsg.id} className="space-y-4">
              {/* User Prompt */}
              <MessageBubble
                role="USER"
                content={userMsg.content}
                imageUrls={userMsg.imageUrls}
                userMessageId={userMsg.id}
              />

              {/* Assistant Response (active version, or streaming regeneration) */}
              {isThisMsgRegenerating ? (
                <div className="space-y-4">
                  {thinkingContent && (
                    <ThinkingBlock content={thinkingContent} isThinking={true} />
                  )}
                  {streamingContent ? (
                    <MessageBubble
                      role="ASSISTANT"
                      content={streamingContent}
                      isStreaming
                      sources={activeSources ? JSON.stringify(activeSources) : null}
                      personaImageUrl={personaImageUrl}
                    />
                  ) : !thinkingContent && (
                    <div className="flex items-start gap-3">
                      {personaImageUrl ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 flex-shrink-0">
                          <img src={personaImageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                        </div>
                      )}
                      <div className="flex gap-1 py-3 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse-dots" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse-dots" style={{ animationDelay: '200ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse-dots" style={{ animationDelay: '400ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : activeResponse ? (
                <MessageBubble
                  role="ASSISTANT"
                  content={activeResponse.content}
                  thinkingContent={activeResponse.thinkingContent}
                  sources={activeResponse.sources}
                  userMessageId={userMsg.id}
                  responses={responses}
                  activeIndex={activeResponseIdx}
                  personaImageUrl={personaImageUrl}
                />
              ) : null}
            </div>
          );
        })}

        {/* Streaming response for new messages */}
        {isStreaming && !regeneratingMessageId && (
          <div className="animate-fade-in space-y-4">
            {thinkingContent && (
              <ThinkingBlock content={thinkingContent} isThinking={true} />
            )}
            {streamingContent ? (
              <MessageBubble
                role="ASSISTANT"
                content={streamingContent}
                isStreaming
                sources={activeSources ? JSON.stringify(activeSources) : null}
                personaImageUrl={personaImageUrl}
              />
            ) : !thinkingContent && (
              <div className="flex items-start gap-3">
                {personaImageUrl ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 flex-shrink-0">
                    <img src={personaImageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                  </div>
                )}
                <div className="flex gap-1 py-3 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse-dots" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse-dots" style={{ animationDelay: '200ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse-dots" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      </div>

      {/* Permanent Scroll to Bottom Arrow Button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 right-8 p-2.5 rounded-full bg-bg-secondary border border-border hover:bg-bg-hover text-text-primary shadow-lg hover:shadow-xl transition-all duration-200 z-10 hover:scale-105 cursor-pointer flex items-center justify-center"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// ThinkingBlock Component
// -------------------------------------------------------------
function ThinkingBlock({ content, isThinking }: { content: string; isThinking: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!content) return null;

  return (
    <div className="bg-bg-secondary/40 border border-border/30 rounded-xl overflow-hidden shadow-sm max-w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-bg-hover/30 transition-all text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-xs font-semibold text-text-secondary">
            {isThinking ? 'Thinking...' : 'Thought Process'}
          </span>
        </div>
        <div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/10 text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CodeBlock Component with Copy Feature
// -------------------------------------------------------------
// Helper to parse separate code blocks from markdown content
function parseCodeBlocks(messageContent: string) {
  const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  let html = '';
  let css = '';
  let js = '';
  let hasBlocks = false;
  let match;

  while ((match = codeBlockRegex.exec(messageContent)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2];
    hasBlocks = true;

    if (lang === 'html') {
      html += code + '\n';
    } else if (lang === 'css') {
      css += code + '\n';
    } else if (lang === 'js' || lang === 'javascript') {
      js += code + '\n';
    } else if (lang === 'svg') {
      html += code + '\n';
    }
  }

  return { html: html.trim(), css: css.trim(), js: js.trim(), hasBlocks };
}

// -------------------------------------------------------------
// CodeBlock Component with Copy & Preview Sandbox Feature
// -------------------------------------------------------------
interface CodeBlockProps {
  language: string;
  value: string;
  messageContent: string;
}

function CodeBlock({ language, value, messageContent }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const openSandbox = useChatStore(s => s.openSandbox);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanLang = (language || '').toLowerCase();
  const isPreviewable = cleanLang === 'html' || value.trim().startsWith('<!DOCTYPE') || value.trim().startsWith('<html');

  const handleOpenSandbox = () => {
    // 1. Standalone SVG
    if (cleanLang === 'svg' || value.trim().startsWith('<svg')) {
      const combined = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f7;
        background-image: radial-gradient(#d1d1d6 1px, transparent 1px);
        background-size: 20px 20px;
        overflow: auto;
      }
      svg {
        max-width: 95vw;
        max-height: 95vh;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.08));
      }
    </style>
  </head>
  <body>
    ${value}
  </body>
</html>`;
      openSandbox(combined, 'svg');
      return;
    }

    // 2. Full HTML Document
    const trimmed = value.trim().toLowerCase();
    if (trimmed.startsWith('<!doctype html>') || trimmed.startsWith('<html>') || value.includes('<html') || value.includes('<body')) {
      openSandbox(value, 'html');
      return;
    }

    // 3. Merged separate blocks (HTML, CSS, JS) from the message
    const blocks = parseCodeBlocks(messageContent);
    const htmlContent = blocks.hasBlocks ? blocks.html : (cleanLang === 'html' ? value : '');
    const cssContent = blocks.hasBlocks ? blocks.css : (cleanLang === 'css' ? value : '');
    const jsContent = blocks.hasBlocks ? blocks.js : (['js', 'javascript'].includes(cleanLang) ? value : '');

    const combined = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #ffffff;
        color: #1f2937;
        padding: 1.5rem;
      }
      ${cssContent}
    </style>
  </head>
  <body>
    ${htmlContent || (jsContent ? '<div id="root"></div>' : '<div class="text-gray-400 font-mono text-xs">Sandbox active. Add HTML/CSS/JS code to preview.</div>')}
    
    <script>
      function runSandbox() {
        try {
          ${jsContent}
        } catch (err) {
          console.error(err);
          const errDiv = document.createElement('div');
          errDiv.style.cssText = 'color: #b91c1c; background-color: #fef2f2; border: 1px solid #fee2e2; padding: 1rem; margin-top: 1rem; font-family: monospace; font-size: 0.875rem; border-radius: 0.375rem; position: relative; z-index: 9999;';
          errDiv.innerHTML = '<strong>Runtime Error:</strong> ' + err.message;
          document.body.appendChild(errDiv);
        }
      }

      // Run code once the DOM is interactive/ready
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(runSandbox, 50);
      } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(runSandbox, 50));
      }

      // Initialize lucide icons
      setTimeout(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 100);
    </script>
  </body>
</html>`;

    openSandbox(combined, 'html');
  };

  return (
    <div className="my-4 border border-[#2d2d2d] rounded-xl overflow-hidden shadow-md bg-[#1e1e1e] text-[#d4d4d4]">
      {/* VS Code titlebar style */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#2d2d2d] text-xs font-mono text-[#969696] select-none">
        <span>{language || 'code'}</span>
        <div className="flex items-center gap-4">
          {isPreviewable && (
            <button
              onClick={handleOpenSandbox}
              className="flex items-center gap-1.5 hover:text-[#cccccc] transition-colors cursor-pointer text-[#8b5cf6] font-medium"
            >
              <Play className="w-3.5 h-3.5 fill-[#8b5cf6]/20" />
              <span>Preview Sandbox</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 hover:text-[#cccccc] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#4ec9b0]" />
                <span className="text-[#4ec9b0] font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* Syntax Highlighting Container */}
      <div className="text-[13.5px] leading-relaxed font-mono overflow-x-auto">
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            fontFamily: 'inherit',
          }}
          codeTagProps={{
            style: {
              background: 'transparent',
              fontFamily: 'inherit',
            }
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MessageBubble Component
// -------------------------------------------------------------
interface MessageBubbleProps {
  role: string;
  content: string;
  thinkingContent?: string | null;
  imageUrls?: string[];
  isStreaming?: boolean;
  sources?: string | null;
  userMessageId?: string;
  responses?: Message[];
  activeIndex?: number;
  personaImageUrl?: string | null;
}

function MessageBubble({
  role,
  content,
  thinkingContent,
  imageUrls = [],
  isStreaming = false,
  sources,
  userMessageId,
  responses = [],
  activeIndex = 0,
  personaImageUrl = null,
}: MessageBubbleProps) {
  const isUser = role === 'USER';
  const { user } = useAuthStore();
  const { editMessage, regenerateResponse, setVersion, setSourcesOpen, activeSources, isSourcesOpen } = useChatStore();

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);

  useEffect(() => {
    setEditValue(content);
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrevVersion = () => {
    if (responses.length > 0 && activeIndex > 0) {
      setVersion(userMessageId!, responses[activeIndex - 1].id);
    }
  };

  const handleNextVersion = () => {
    if (responses.length > 0 && activeIndex < responses.length - 1) {
      setVersion(userMessageId!, responses[activeIndex + 1].id);
    }
  };

  const handleToggleSources = () => {
    if (sources) {
      try {
        const parsed = JSON.parse(sources);
        useChatStore.setState({ activeSources: parsed });
        setSourcesOpen(!isSourcesOpen);
      } catch (e) {
        console.error('Failed to parse sources', e);
      }
    }
  };

  // Helper parser for inline `<think>...</think>` tags
  const parseMessage = (text: string) => {
    if (text.includes('<think>')) {
      const parts = text.split('<think>');
      const rest = parts[1] || '';
      if (rest.includes('</think>')) {
        const subParts = rest.split('</think>');
        return {
          inlineThinking: subParts[0].trim(),
          cleanContent: subParts.slice(1).join('</think>').trim(),
        };
      } else {
        return {
          inlineThinking: rest.trim(),
          cleanContent: '',
        };
      }
    }
    return { inlineThinking: undefined, cleanContent: text };
  };

  const { inlineThinking, cleanContent } = parseMessage(content);

  // Preprocess cleanContent to support multi-source bracket citations (e.g., [Source 2, Source 5] or [Source 2, 5])
  const processedContent = cleanContent.replace(/\[Source\s+([\d,\s\w\-]+)\]/gi, (_match, contentInside) => {
    const parts = contentInside.split(',');
    return parts.map((part: string) => {
      const numMatch = part.match(/\d+/);
      if (numMatch) {
        const num = numMatch[0];
        return `[Source ${num}](https://source.citation/${num})`;
      }
      return part.trim();
    }).join(' ');
  });

  // Markdown component overrides
  const markdownComponents = {
    pre(props: any) {
      return <>{props.children}</>;
    },
    code(props: any) {
      const { children, className, node, ...rest } = props;
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const isBlock = className && className.includes('language-');

      if (isBlock) {
        return (
          <CodeBlock language={language} value={String(children).replace(/\n$/, '')} messageContent={content} />
        );
      }
      return (
        <code className="bg-bg-tertiary border border-border/40 px-1 py-0.5 rounded text-xs text-accent font-mono" {...rest}>
          {children}
        </code>
      );
    },
    a(props: any) {
      const { href, children, ...rest } = props;
      const childrenText = String(children || '').trim();
      const isCustomSchema = href && href.startsWith('https://source.citation/');
      const isSourceText = /^source\s+\d+$/i.test(childrenText);

      if (isCustomSchema || (href && isSourceText)) {
        let sourceIndex = -1;
        if (isCustomSchema) {
          sourceIndex = parseInt(href.substring(24), 10) - 1; // "https://source.citation/" is 24 chars
        } else {
          const match = childrenText.match(/source\s+(\d+)/i);
          if (match) {
            sourceIndex = parseInt(match[1], 10) - 1;
          }
        }

        let resolvedUrl: string | null = null;
        let sourceTitle: string | null = null;

        // Try to get original URL from the message sources JSON
        if (sourceIndex >= 0 && sources) {
          try {
            const parsedSources = JSON.parse(sources);
            const source = parsedSources[sourceIndex];
            if (source && source.url) {
              resolvedUrl = source.url;
              sourceTitle = source.title || null;
            }
          } catch (e) {
            console.error('Failed to parse sources for inline link', e);
          }
        }

        // Fallback: If not resolved, but original href is a valid external URL (not our mock custom schema)
        if (!resolvedUrl && href && !href.startsWith('https://source.citation/')) {
          resolvedUrl = href;
        }

        // If we successfully resolved the URL, render a premium clickable logo badge
        if (resolvedUrl) {
          try {
            const domain = new URL(resolvedUrl).hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
            return (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-bg-secondary border border-border hover:border-accent hover:scale-110 rounded-full w-[18px] h-[18px] transition-all mx-0.5 select-none align-middle shadow-sm hover:shadow"
                title={sourceTitle || domain}
              >
                <img
                  src={faviconUrl}
                  alt=""
                  className="w-3.5 h-3.5 rounded-full object-contain"
                  onError={(e) => {
                    // Fallback to globe if icon fails to load
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-globe"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
                  }}
                />
              </a>
            );
          } catch {
            return (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-bg-secondary border border-border hover:border-accent rounded-full w-[18px] h-[18px] text-[9px] font-bold text-accent mx-0.5 align-middle select-none"
              >
                {sourceIndex >= 0 ? sourceIndex + 1 : '🔗'}
              </a>
            );
          }
        }

        // If no URL can be resolved, render a neat non-clickable badge
        return (
          <span
            className="inline-flex items-center justify-center bg-bg-secondary border border-border rounded-full w-[18px] h-[18px] text-[9px] font-semibold text-text-muted mx-0.5 align-middle select-none shadow-sm cursor-help"
            title="Source link unavailable"
          >
            {sourceIndex >= 0 ? sourceIndex + 1 : '🔗'}
          </span>
        );
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" {...rest}>
          {children}
        </a>
      );
    }
  };

  return (
    <div className="animate-fade-in space-y-2">
      {/* 1. Thought Process (SSE thinkingContent or parsed inlineThinking) */}
      {(thinkingContent || inlineThinking) && (
        <div className="flex items-start">
          {!isUser && <div className="w-8 flex-shrink-0 mr-3" />}
          <div className="flex-1 min-w-0">
            <ThinkingBlock
              content={thinkingContent || inlineThinking || ''}
              isThinking={isStreaming && !cleanContent}
            />
          </div>
          {isUser && <div className="w-8 flex-shrink-0 ml-3" />}
        </div>
      )}

      {/* 2. Message Body */}
      {(!isStreaming || cleanContent) && (
        <div className={`flex items-start w-full ${isUser ? 'justify-end' : ''}`}>
          {/* Left Avatar (Assistant) */}
          {!isUser && (
            personaImageUrl ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 flex-shrink-0 mr-3">
                <img src={personaImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0 mr-3">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
            )
          )}

          {isUser ? (
            <div className={`flex flex-col items-end gap-1.5 group/userMsg ${isEditing ? 'w-[70%] md:w-full' : 'max-w-[80%]'}`}>
              <div className={`bg-bg-secondary border border-border rounded-2xl text-text-primary shadow-sm w-full ${isEditing ? 'p-4' : 'px-4 py-2.5'}`}>
                {isEditing ? (
                  <div className="w-full flex flex-col">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full min-h-[60px] bg-transparent border-0 outline-none resize-none text-[15px] text-text-primary font-sans leading-relaxed focus:ring-0 focus:outline-none p-0"
                      placeholder="Edit your message..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (editValue.trim() && editValue.trim() !== content) {
                            setIsEditing(false);
                            if (userMessageId) {
                              editMessage(userMessageId, editValue.trim());
                            }
                          }
                        }
                      }}
                    />
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditValue(content);
                        }}
                        className="px-4 py-1.5 rounded-full hover:bg-white/10 text-white text-xs font-semibold transition-all cursor-pointer bg-transparent border border-border/40"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (editValue.trim() && editValue.trim() !== content) {
                            setIsEditing(false);
                            if (userMessageId) {
                              await editMessage(userMessageId, editValue.trim());
                            }
                          } else {
                            setIsEditing(false);
                          }
                        }}
                        className="px-4 py-1.5 rounded-full bg-white text-black hover:opacity-90 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Render uploaded image attachments for User messages */}
                    {imageUrls.length > 0 && (
                      <div className="flex flex-row-reverse flex-wrap gap-1 mb-2 justify-start">
                        {imageUrls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt="attachment"
                            className="w-[120px] h-[90px] object-cover rounded-lg border border-border/40"
                            style={{ padding: '2px' }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Markdown Text */}
                    <div className="prose max-w-none text-[15px] leading-relaxed break-words">
                      <p className="whitespace-pre-wrap m-0">{cleanContent}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Action buttons below the user message box */}
              {!isEditing && (
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/userMsg:opacity-100 focus-within:opacity-100 transition-opacity duration-200 text-text-muted mt-1 mr-1">
                  {/* Edit button */}
                  {userMessageId && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 hover:text-text-primary rounded transition-colors cursor-pointer flex items-center justify-center"
                      title="Edit prompt"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Copy Button */}
                  <button
                    onClick={handleCopy}
                    className="p-1 hover:text-text-primary rounded transition-colors cursor-pointer flex items-center justify-center"
                    title="Copy prompt"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-0 text-text-primary pt-1">
              {/* Markdown Text */}
              <div className="prose max-w-none text-[15px] leading-relaxed break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{processedContent}</ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse" />
                )}
              </div>

              {/* Premium action toolbar for Assistant messages (not during streaming) */}
              {!isStreaming && (
                <div className="flex items-center gap-2 mt-4 text-text-muted select-none text-[11px]">
                  <div className="flex items-center gap-0.5 bg-bg-tertiary border border-border/40 rounded-lg p-0.5 shadow-sm">
                    {/* 1. Version Switcher (on the left of copy button) */}
                    {responses.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevVersion}
                          disabled={activeIndex === 0}
                          className="p-1.5 rounded-md hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                          title="Previous version"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-semibold tabular-nums text-text-secondary px-1 text-center min-w-[32px]">
                          {activeIndex + 1}/{responses.length}
                        </span>
                        <button
                          onClick={handleNextVersion}
                          disabled={activeIndex === responses.length - 1}
                          className="p-1.5 rounded-md hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer mr-1 border-r border-border/30 pr-2"
                          title="Next version"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* Copy Button */}
                    <button
                      onClick={handleCopy}
                      className="p-1.5 rounded-md hover:text-text-primary hover:bg-bg-hover transition-all cursor-pointer flex items-center gap-1"
                      title="Copy response"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Regenerate Button */}
                    {userMessageId && (
                      <button
                        onClick={() => regenerateResponse(userMessageId)}
                        className="p-1.5 rounded-md hover:text-text-primary hover:bg-bg-hover transition-all cursor-pointer flex items-center gap-1"
                        title="Regenerate response"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Sources Button */}
                    {sources && (
                      <button
                        onClick={handleToggleSources}
                        className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          isSourcesOpen && activeSources && JSON.stringify(activeSources) === sources
                            ? 'text-success bg-success/10'
                            : 'hover:text-text-primary hover:bg-bg-hover'
                        }`}
                        title="View search sources"
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Avatar (User) */}
          {isUser && (
            <div className="w-8 h-8 rounded-full bg-bg-secondary border border-border flex items-center justify-center flex-shrink-0 ml-3 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-text-secondary">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
