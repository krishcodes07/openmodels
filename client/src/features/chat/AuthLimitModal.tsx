import { useChatStore } from '../../stores/chatStore';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Shield, ArrowRight, MessageSquare } from 'lucide-react';

export function AuthLimitModal() {
  const navigate = useNavigate();
  const { showAuthLimitModal, setShowAuthLimitModal } = useChatStore();

  if (!showAuthLimitModal) return null;

  const handleAction = (mode: 'login' | 'signup') => {
    setShowAuthLimitModal(false);
    navigate(`/auth?mode=${mode}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={() => setShowAuthLimitModal(false)}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-bg-secondary border border-border rounded-2xl p-8 shadow-2xl z-10 animate-fade-in overflow-hidden">
        {/* Background Decorative Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setShowAuthLimitModal(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Main Content */}
        <div className="text-center relative z-10 mt-2">
          {/* Glowing Icon Container */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-purple-500 shadow-glow mb-6">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-2">
            Upgrade Your Experience
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-8 px-2">
            You've sent 5 free messages this session. Log in or create a free account to continue chatting, save history, and customize your settings.
          </p>

          {/* Benefits List */}
          <div className="space-y-3.5 mb-8 text-left max-w-xs mx-auto">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <div className="text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">Save Chat History</span> — access past conversations from any device.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <div className="text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">Custom Keys & Models</span> — connect own keys for unlimited usage.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAction('signup')}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-glow hover:shadow-lg"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleAction('login')}
              className="w-full py-3 text-sm font-semibold text-text-secondary hover:text-text-primary rounded-xl border border-border hover:bg-bg-hover transition-all duration-200"
            >
              Sign In to Your Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
