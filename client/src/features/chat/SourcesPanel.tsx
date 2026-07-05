import { useChatStore } from '../../stores/chatStore';
import { X, Globe, ExternalLink } from 'lucide-react';

export function SourcesPanel() {
  const { isSourcesOpen, activeSources, setSourcesOpen } = useChatStore();

  if (!isSourcesOpen) return null;

  const getDomainName = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      const host = url.hostname.replace('www.', '');
      return host;
    } catch {
      return 'Web Link';
    }
  };

  const getFaviconUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return `https://www.google.com/s2/favicons?sz=64&domain=${url.hostname}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed md:static inset-y-0 right-0 z-40 w-full sm:w-[350px] md:w-[350px] border-l border-border bg-bg-secondary flex flex-col h-full animate-slide-right flex-shrink-0 shadow-2xl md:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/80 bg-bg-secondary">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-success" />
          <h3 className="text-sm font-semibold text-text-primary">Search Sources</h3>
        </div>
        <button
          onClick={() => setSourcesOpen(false)}
          className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeSources || activeSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-text-muted space-y-2">
            <Globe className="w-8 h-8 opacity-25" />
            <p className="text-xs">No source metadata found for this message.</p>
          </div>
        ) : (
          activeSources.map((source, idx) => {
            const domain = getDomainName(source.url);
            const favicon = getFaviconUrl(source.url);

            return (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-bg-tertiary border border-border/50 hover:border-accent/30 rounded-xl p-4 transition-all hover:bg-bg-hover group shadow-sm"
              >
                {/* Logo and Domain */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-white flex items-center justify-center overflow-hidden border border-border/30 p-0.5 flex-shrink-0">
                    {favicon ? (
                      <img
                        src={favicon}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe className="w-3 h-3 text-text-muted" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider group-hover:text-accent transition-colors">
                    {domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Title */}
                <h4 className="text-xs font-bold text-text-primary leading-snug line-clamp-2 mb-1.5 group-hover:text-accent transition-colors">
                  {source.title || 'Untitled Source'}
                </h4>

                {/* Description snippet */}
                {source.description && (
                  <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">
                    {source.description}
                  </p>
                )}
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
