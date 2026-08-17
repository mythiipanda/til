'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { X, Mail, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';

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
      <div className="relative w-full max-w-[400px] bg-white border border-neutral-200 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center text-white font-mono font-bold text-xs tracking-tighter">
              TD
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">TDILEARNED Account</h2>
              <p className="text-[11px] text-neutral-500">Sign in with passwordless magic link</p>
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
              We sent a passwordless sign-in link to <span className="font-semibold text-neutral-800">{email}</span>. Click the link to log in immediately.
            </p>
            <button
              onClick={() => setSentMagicLink(false)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 underline pt-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="pt-5 space-y-4">
            <form onSubmit={handleMagicLink} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="curious.researcher@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-medium transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
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

            <p className="text-[10px] text-neutral-400 text-center leading-normal pt-1">
              No passwords required. Your mindmaps and pinned research are automatically synced to your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
