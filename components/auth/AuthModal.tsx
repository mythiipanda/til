'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { X, Mail, Github, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentMagicLink, setSentMagicLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) throw error;
    } catch (e: any) {
      console.error('OAuth error:', e);
      setErrorMsg(e.message || 'Failed to initialize OAuth.');
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        },
      });

      if (error) throw error;
      setSentMagicLink(true);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      console.error('Magic link error:', e);
      setErrorMsg(e.message || 'Failed to send Magic Link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-[420px] bg-white border border-neutral-200 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center text-white font-mono font-bold text-xs tracking-tighter">
              TD
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">TDILEARNED Account</h2>
              <p className="text-[11px] text-neutral-500">Sync & share spatial mindmaps across devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {sentMagicLink ? (
          <div className="py-8 text-center space-y-3 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 rounded-full flex items-center justify-center mx-auto text-neutral-900">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900">Check your inbox</h3>
            <p className="text-xs text-neutral-500 max-w-[280px] mx-auto leading-relaxed">
              We sent a passwordless sign-in link to <span className="font-semibold text-neutral-800">{email}</span>. Click the link to log in.
            </p>
            <button
              onClick={() => setSentMagicLink(false)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 underline pt-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-5">
            {/* OAuth Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleOAuth('google')}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-800 rounded-xl text-xs font-medium transition-all shadow-sm active:scale-[0.99] disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleOAuth('github')}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-medium transition-all shadow-sm active:scale-[0.99] disabled:opacity-60"
              >
                <Github className="w-4 h-4" />
                Continue with GitHub
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-neutral-200 w-full" />
              <span className="bg-white px-2.5 text-[10px] text-neutral-400 uppercase font-mono tracking-wider">or magic link</span>
            </div>

            {/* Email Magic Link Form */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="curious.researcher@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                    Send Passwordless Magic Link
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-neutral-400 text-center leading-normal pt-2">
              By signing in, your mindmaps will automatically be backed up and accessible from any device.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
