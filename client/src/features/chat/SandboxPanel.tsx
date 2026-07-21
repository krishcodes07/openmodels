import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { X, Code2, Eye, RotateCcw, Copy, Check, Download, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';

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

  const [width, setWidth] = useState(() => Number(localStorage.getItem('sandboxWidth')) || Math.min(600, Math.floor(window.innerWidth * 0.5)));
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);

      if (window.innerWidth >= 768) {
        const activeSidebarOpen = useChatStore.getState().isSidebarOpen;
        const otherWidth = activeSidebarOpen ? (Number(localStorage.getItem('sidebarWidth')) || 256) : 0;
        const maxAllowedWidth = Math.max(320, window.innerWidth - otherWidth - 380);
        if (width > maxAllowedWidth) {
          const newW = Math.max(320, maxAllowedWidth);
          setWidth(newW);
          localStorage.setItem('sandboxWidth', String(newW));
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
      const activeSidebarOpen = useChatStore.getState().isSidebarOpen;
      const otherWidth = activeSidebarOpen ? (Number(localStorage.getItem('sidebarWidth')) || 256) : 0;
      const maxAllowedWidth = Math.max(320, window.innerWidth - otherWidth - 380);
      const limitWidth = Math.min(Math.floor(window.innerWidth * 0.85), maxAllowedWidth);

      const newWidth = startWidth - (moveEvent.clientX - startX);
      if (newWidth >= 320 && newWidth <= limitWidth) {
        setWidth(newWidth);
        localStorage.setItem('sandboxWidth', String(newWidth));
      } else if (newWidth > limitWidth) {
        setWidth(limitWidth);
        localStorage.setItem('sandboxWidth', String(limitWidth));
      } else if (newWidth < 320) {
        setWidth(320);
        localStorage.setItem('sandboxWidth', String(320));
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

  const sandboxStyle = !isMobile
    ? {
        width: `${width}px`,
      }
    : undefined;

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

  return (
    <aside
      style={sandboxStyle}
      className={`inset-y-0 right-0 z-40 h-full bg-bg-secondary flex flex-col border-l border-border shadow-2xl md:shadow-none select-none animate-slide-right flex-shrink-0
        fixed md:relative md:inset-y-auto md:right-auto md:z-0
        ${isMobile ? 'w-full' : ''}
        ${isDragging ? 'transition-none' : 'transition-all duration-200 ease-out'}
      `}
    >
      {/* Drag handle */}
      {!isMobile && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 -left-1 w-2 h-full cursor-col-resize z-50 select-none group flex justify-center"
        >
          <div className={`w-[2px] h-full transition-colors duration-150 ${isDragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/40'}`} />
        </div>
      )}

      {/* Full screen resize overlay */}
      {isDragging && (
        <div className="fixed inset-0 cursor-col-resize z-[9999] select-none pointer-events-auto" />
      )}
      {/* Sandbox Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary h-[57px]">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-text-primary text-sm tracking-wide">Sandbox Preview</h2>
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
            <Editor
              height="100%"
              width="100%"
              language={
                activeSandboxLanguage === 'js' || activeSandboxLanguage === 'javascript'
                  ? 'javascript'
                  : activeSandboxLanguage === 'ts' || activeSandboxLanguage === 'typescript'
                  ? 'typescript'
                  : activeSandboxLanguage === 'svg'
                  ? 'xml'
                  : activeSandboxLanguage || 'html'
              }
              theme="vs-dark"
              value={activeSandboxCode}
              onChange={(value) => updateSandboxCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                tabSize: 2,
                wordWrap: 'on',
              }}
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
              sandbox="allow-scripts allow-modals"
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
