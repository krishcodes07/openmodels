import { useChatStore } from '../../stores/chatStore';
import { ArrowRight } from 'lucide-react';

const SUGGESTIONS = [
  { text: 'Explain quantum computing in simple terms' },
  { text: 'Write a Python function to sort a list' },
  { text: 'Help me draft a professional email' },
  { text: 'What are the latest trends in AI?' },
];

export function WelcomeScreen() {
  const { sendMessage } = useChatStore();

  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
      <div className="max-w-xl w-full animate-fade-in">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold text-text-primary mb-3 tracking-tight">
            What can I help you with?
          </h1>
          <p className="text-text-secondary text-sm">
            Chat with the world&apos;s best AI models through a single interface
          </p>
        </div>

        {/* Suggestions */}
        <div className="grid grid-cols-2 gap-2.5">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s.text)}
              className="group flex items-center gap-3 bg-bg-secondary border border-border hover:border-accent/20 rounded-xl p-4 text-left transition-all duration-150"
            >
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors flex-1 leading-snug">
                {s.text}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
