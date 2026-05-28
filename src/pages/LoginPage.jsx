import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Gift, ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { checkUserAuth } = useAuth();

  const fromUrl = searchParams.get('from_url') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await base44.auth.loginViaEmailPassword(email, password);
        if (result.access_token) {
          await checkUserAuth();
          window.location.href = fromUrl;
          return;
        }
      } else {
        const result = await base44.auth.register({ email, password });

        if (result?.session) {
          await checkUserAuth();
          window.location.href = fromUrl;
          return;
        }

        if (result?.user) {
          setError('Please check your email and confirm your account before signing in.');
          setMode('login');
          return;
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = (provider) => {
    base44.auth.loginWithProvider(provider, fromUrl);
  };

  return (
    <div className="min-h-screen bg-sand-50 font-body flex flex-col">
      {/* Header */}
      <div className="px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2 text-ink-soft hover:text-ink transition-colors text-sm font-heading font-semibold">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-terracotta/10 mb-4">
              <Gift className="w-7 h-7 text-terracotta" />
            </div>
            <h1 className="font-heading font-bold text-2xl text-ink mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-ink-soft text-sm">
              {mode === 'login' ? 'Sign in to continue being thoughtful' : 'Start your thoughtful journey'}
            </p>
          </div>

          {/* Google SSO */}
          <button
            onClick={() => handleProviderLogin('google')}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-sand-300 rounded-xl py-3 px-4 font-heading font-semibold text-sm text-ink hover:border-sand-200 hover:bg-sand-50 transition-all mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-sand-300" />
            <span className="text-ink-soft text-xs font-heading">or</span>
            <div className="flex-1 h-px bg-sand-300" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-sand-300 rounded-xl text-sm text-ink placeholder:text-ink-soft/50 focus:border-terracotta focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-3 bg-white border-2 border-sand-300 rounded-xl text-sm text-ink placeholder:text-ink-soft/50 focus:border-terracotta focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-terracotta text-white py-3 rounded-xl font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-ink-soft text-sm mt-5">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-terracotta font-semibold hover:text-terracotta-dark transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
