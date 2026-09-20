'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

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
    <Modal
      open={isOpen}
      onClose={onClose}
      label="Sign in to TDILEARNED"
      badge="TDI"
      title={sentMagicLink ? 'Check Your Inbox' : 'Sign in'}
      subtitle={sentMagicLink ? 'Link Sent' : 'No Password Needed'}
      maxWidth="max-w-md"
      closeLabel="Close sign in dialog"
    >
      <div className="pt-6 space-y-5">
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
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
                EMAIL SENT
              </div>
              <h3 className="font-serif text-2xl font-bold text-black leading-tight">
                Check Your Inbox
              </h3>
              <p className="font-body text-xs text-neutral-700 leading-relaxed">
                We sent a sign-in link to:
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
                  className="w-full px-4 py-3 bg-white border-2 border-black font-body text-sm text-black placeholder:text-neutral-400 placeholder:italic outline-none focus:bg-neutral-50 transition-shadow"
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
                  <span>Email me a link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="border-t border-neutral-200 pt-3">
              <p className="font-body text-xs text-neutral-600 leading-relaxed">
                No password needed. Sign in to save your mindmaps and open them on any device.
              </p>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
