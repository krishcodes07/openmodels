import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { X, Code2, Eye, RotateCcw, Copy, Check, Download, RefreshCw } from 'lucide-react';

export function SandboxPanel() {
  const {
    activeSandboxCode,
    activeSandboxOriginalCode,
    activeSandboxLanguage,
    isSandboxOpen,
    updateSandboxCode,
    closeSandbox,
    resetSandboxCode,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // Used to force-reload the iframe

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-switch to preview when a new sandbox is opened
  useEffect(() => {
    if (isSandboxOpen) {
      setActiveTab('preview');
      setIframeKey(prev => prev + 1);
    }
  }, [isSandboxOpen, activeSandboxOriginalCode]);

  // Force iframe reload when user switches back to preview tab to see latest edits immediately
  useEffect(() => {
    if (activeTab === 'preview') {
      setIframeKey(prev => prev + 1);
    }
  }, [activeTab]);

  // Debounce iframe key update to reload iframe and re-execute scripts after typing in Code Editor ceases
  useEffect(() => {
    if (activeTab === 'code') {
      const timer = setTimeout(() => {
        setIframeKey(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [activeSandboxCode, activeTab]);

  if (!isSandboxOpen || activeSandboxCode === null) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSandboxCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let extension = 'txt';
    const lang = (activeSandboxLanguage || '').toLowerCase();
    if (lang === 'html') extension = 'html';
    else if (lang === 'svg') extension = 'svg';
    else if (lang === 'js' || lang === 'javascript') extension = 'js';
    else if (lang === 'jsx') extension = 'jsx';
    else if (lang === 'ts' || lang === 'typescript') extension = 'ts';
    else if (lang === 'tsx') extension = 'tsx';
    else if (lang === 'css') extension = 'css';
    else if (lang === 'xml') extension = 'xml';

    const blob = new Blob([activeSandboxCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sandbox-export.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  // Compile helper to construct iframe content based on code and language
  const getIframeSrcDoc = (code: string, language: string) => {
    // If the code is already a complete HTML document (which our preprocessor generates), just return it directly!
    const trimmed = code.trim().toLowerCase();
    if (trimmed.startsWith('<!doctype html>') || trimmed.startsWith('<html>') || code.includes('<html') || code.includes('<body')) {
      return code;
    }

    const cleanLang = (language || '').toLowerCase();
    const isSvg = cleanLang === 'svg' || trimmed.startsWith('<svg');

    if (isSvg) {
      return `
        <!DOCTYPE html>
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
            ${code}
          </body>
        </html>
      `;
    }

    // Default HTML/CSS/JS template
    return `
      <!DOCTYPE html>
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
          </style>
        </head>
        <body>
          ${code}
          <script>
            setTimeout(() => {
              if (typeof lucide !== 'undefined') {
                lucide.createIcons();
              }
            }, 100);
          </script>
        </body>
      </html>
    `;
  };

  const lines = activeSandboxCode.split('\n');

  return (
    <aside className="fixed md:static inset-y-0 right-0 z-40 w-full md:w-[50vw] border-l border-border h-full bg-bg-secondary flex flex-col shadow-2xl md:shadow-none relative select-none animate-slide-right">
      {/* Sandbox Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary h-[57px]">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-text-primary text-sm tracking-wide">Sandbox Sandbox</h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono uppercase font-bold">
            {activeSandboxLanguage || 'code'}
          </span>
        </div>

        {/* Toolbar items */}
        <div className="flex items-center gap-1">
          <button
            onClick={resetSandboxCode}
            disabled={activeSandboxCode === activeSandboxOriginalCode}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Reset to Original"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Download File"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-border mx-1" />
          <button
            onClick={closeSandbox}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-bg-primary/50 px-2 py-1 gap-1">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-accent/15 text-accent border border-accent/25 shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Interactive Preview</span>
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'code'
              ? 'bg-accent/15 text-accent border border-accent/25 shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code Editor</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* CODE TAB */}
        {activeTab === 'code' && (
          <div className="w-full h-full flex font-mono text-[13px] bg-[#1e1e1e] text-[#d4d4d4] overflow-hidden select-text">
            {/* Line Numbers gutter */}
            <div className="py-4 text-right pr-3 pl-4 text-[#858585] select-none bg-[#1e1e1e] border-r border-[#2d2d2d] w-[50px] overflow-hidden font-mono leading-[21px]">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Editable text container */}
            <textarea
              ref={textareaRef}
              value={activeSandboxCode}
              onChange={(e) => updateSandboxCode(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className="flex-1 h-full py-4 px-4 bg-transparent outline-none border-none resize-none font-mono text-[13px] leading-[21px] overflow-y-auto text-[#d4d4d4] caret-white whitespace-pre select-text"
              style={{ tabSize: 2 }}
            />
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className="w-full h-full bg-[#f9fafb] relative flex flex-col">
            <iframe
              key={iframeKey}
              srcDoc={getIframeSrcDoc(activeSandboxCode, activeSandboxLanguage || 'html')}
              title="Sandbox Interactive Preview"
              sandbox="allow-scripts allow-same-origin allow-modals"
              className="flex-1 border-none w-full bg-white"
            />
            {/* Soft refresh indicator button inside viewport */}
            <button
              onClick={handleRefresh}
              className="absolute bottom-4 right-4 bg-bg-primary/80 backdrop-blur border border-border text-text-secondary hover:text-text-primary hover:bg-bg-primary shadow-md p-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center"
              title="Refresh Preview"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
