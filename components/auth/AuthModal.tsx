'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { X, Mail, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentMagicLink, setSentMagicLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSentMagicLink(false);
        setErrorMsg(null);
      }, 100);
    }
  }, [isOpen]);

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
    } catch (e: any) {
      console.error('Magic link error:', e);
      setErrorMsg(e.message || 'Failed to send Magic Link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getEmailProviderLink = () => {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    if (domain.includes('gmail')) return 'https://mail.google.com';
    if (domain.includes('outlook') || domain.includes('hotmail')) return 'https://outlook.live.com';
    if (domain.includes('yahoo')) return 'https://mail.yahoo.com';
    if (domain.includes('proton')) return 'https://mail.proton.me';
    return null;
  };

  const emailProviderUrl = getEmailProviderLink();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-none p-4 animate-fade">
      <div className="relative w-full max-w-md bg-white border-2 border-black p-6 md:p-8 space-y-6 shadow-none">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase font-bold bg-black text-white px-2 py-0.5">
              TDI
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold tracking-tight text-black">
                {sentMagicLink ? 'Check Your Inbox' : 'Account Access'}
              </h2>
              <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                {sentMagicLink ? 'Sign-in Link Sent' : 'Passwordless Email Sign-In'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-black hover:bg-black hover:text-white transition-colors duration-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-white border-2 border-black flex items-start gap-2.5 font-mono text-xs text-black">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {sentMagicLink ? (
          <div className="py-4 space-y-6 animate-fade">
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                EMAIL SENT
              </div>
              <h3 className="font-serif text-2xl font-bold text-black leading-tight">
                Check Your Inbox
              </h3>
              <p className="font-body text-xs text-neutral-700 leading-relaxed">
                A secure sign-in link has been sent to:
              </p>
              <div className="p-3 bg-neutral-50 border-2 border-black font-mono text-xs font-bold text-black break-all">
                {email}
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="border-t border-black pt-4 space-y-2 font-mono text-xs text-neutral-800">
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center font-bold text-[10px]">
                  1
                </span>
                <span>Open your email client</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center font-bold text-[10px]">
                  2
                </span>
                <span>Click &quot;Sign In to TDILEARNED&quot;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center font-bold text-[10px]">
                  3
                </span>
                <span>Your saved mindmaps sync automatically</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {emailProviderUrl && (
                <a
                  href={emailProviderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-widest transition-colors duration-100"
                >
                  <span>Open {email.split('@')[1]}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setSentMagicLink(false)}
                  className="font-mono text-xs text-neutral-600 hover:text-black uppercase tracking-wider underline underline-offset-2"
                >
                  ← Use different email
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border-2 border-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-black hover:text-white transition-colors duration-100"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-5 pt-2">
            <div className="space-y-2">
              <label className="block font-mono text-[11px] uppercase font-bold tracking-widest text-black">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-4 py-3 bg-white border-2 border-black font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:bg-neutral-50 transition-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-mono text-xs uppercase font-bold tracking-widest transition-colors duration-100 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-current" />
              ) : (
                <>
                  <span>Send Passwordless Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="border-t border-neutral-200 pt-3">
              <p className="font-body text-xs text-neutral-600 leading-relaxed">
                Zero passwords required. Your mindmaps and research dossiers will be permanently preserved and accessible from any device.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
