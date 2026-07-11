import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  
  const [isLogin, setIsLogin] = useState(true);

  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');
  const accessTokenParam = searchParams.get('accessToken');
  const refreshTokenParam = searchParams.get('refreshToken');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const { login, register, googleLogin, authActionLoading, error } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }
  }, [mode]);

  useEffect(() => {
    if (verified === 'true') {
      if (accessTokenParam && refreshTokenParam) {
        setSuccessMessage('Email verified successfully! Logging you in...');
        api.setTokens(accessTokenParam, refreshTokenParam);
        const timer = setTimeout(async () => {
          await useAuthStore.getState().checkAuth();
          navigate('/', { replace: true });
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        setSuccessMessage('Email verified successfully! You can now log in.');
        setIsLogin(true);
        navigate('/auth', { replace: true });
      }
    } else if (verified === 'false') {
      if (errorParam === 'expired_token') {
        setLocalError('The verification link has expired. Please log in to receive a new link.');
      } else if (errorParam === 'invalid_token') {
        setLocalError('The verification link is invalid.');
      } else {
        setLocalError('Email verification failed. Please try again.');
      }
      navigate('/auth', { replace: true });
    }
  }, [verified, errorParam, accessTokenParam, refreshTokenParam, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(true);

  const handleResendVerification = async () => {
    if (!email) {
      setLocalError('Please enter your email address first.');
      return;
    }
    setResendStatus('loading');
    try {
      await api.resendVerification(email);
      setResendStatus('success');
      setSuccessMessage('A new verification email has been sent!');
      setLocalError('');
    } catch (err: any) {
      setResendStatus('error');
      setLocalError(err.message || 'Failed to resend verification email');
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = async () => {
      try {
        const config = await api.getAuthConfig();
        if (!isMounted) return;

        if (config.googleClientId) {
          setGoogleClientId(config.googleClientId);
          
          const google = (window as any).google;
          if (google) {
            google.accounts.id.initialize({
              client_id: config.googleClientId,
              callback: async (response: any) => {
                try {
                  await googleLogin(response.credential);
                  navigate('/');
                } catch (err: any) {
                  setLocalError(err.message || 'Google login failed');
                }
              },
            });

            // Delay rendering slightly to ensure container is in DOM
            setTimeout(() => {
              if (isMounted) {
                const btnWidth = Math.min(352, Math.max(200, window.innerWidth - 64));
                google.accounts.id.renderButton(
                  document.getElementById('google-signin-btn'),
                  {
                    theme: 'outline',
                    size: 'large',
                    width: btnWidth,
                    text: 'continue_with',
                    shape: 'pill',
                  }
                );
                setIsGoogleLoading(false);
              }
            }, 100);
          }
        } else {
          setIsGoogleLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize Google Sign In:', err);
        if (isMounted) setIsGoogleLoading(false);
      }
    };

    return () => {
      isMounted = false;
      document.body.removeChild(script);
    };
  }, [googleLogin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (password.length < 6) {
          setLocalError('Password must be at least 6 characters');
          return;
        }
        await register(email, password, name);
      }
      navigate('/');
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              OpenModels
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Chat with any AI model from a single interface
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-lg">
          {/* Tabs */}
          <div className="flex mb-8 bg-bg-tertiary rounded-xl p-1">
            <button
              onClick={() => { setIsLogin(true); setLocalError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isLogin
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setLocalError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                !isLogin
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in text-center font-medium">
              {successMessage}
            </div>
          )}

          {/* Error */}
          {(localError || error) && (
            <div className="mb-6 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm animate-fade-in">
              <div>{localError || error}</div>
              {(localError === 'Email verification required' || error === 'Email verification required') && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendStatus === 'loading'}
                  className="mt-2 text-xs font-semibold text-accent hover:text-accent-hover underline block disabled:opacity-50"
                >
                  {resendStatus === 'loading' ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="animate-fade-in">
                <label className="block text-sm text-text-secondary mb-2">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-bg-tertiary border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-text-secondary mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-bg-tertiary border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-bg-tertiary border border-border rounded-xl py-3 pl-10 pr-12 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authActionLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 text-white py-3 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow hover:shadow-lg"
            >
              {authActionLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-text-muted text-xs">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google Login */}
          {googleClientId ? (
            <div className="w-full flex justify-center py-1">
              <div id="google-signin-btn" className="w-full flex justify-center overflow-hidden" />
            </div>
          ) : isGoogleLoading ? (
            <div className="w-full flex items-center justify-center py-3 bg-bg-tertiary border border-border rounded-xl">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-3 bg-bg-tertiary border border-border opacity-50 hover:bg-bg-hover text-text-primary py-3 rounded-xl text-sm font-medium transition-all duration-200"
              onClick={() => {
                setLocalError('Google OAuth is not configured on the backend. Please set GOOGLE_CLIENT_ID in your .env file.');
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google OAuth Not Configured
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
