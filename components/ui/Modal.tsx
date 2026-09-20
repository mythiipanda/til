'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from './useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (aria-label). */
  label: string;
  /** Mono badge shown in the header, e.g. "EXPORT". */
  badge?: ReactNode;
  /** Serif title shown in the header. */
  title?: ReactNode;
  /** Optional mono micro-label under the title. */
  subtitle?: ReactNode;
  /** Panel max width, e.g. "max-w-lg". */
  maxWidth?: string;
  /** Close button label for screen readers. */
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Shared modal shell — one anatomy for every dialog in the app.
 * Scrim: bg-black/60 + .backdrop-enter at z-modal. Panel: white, 2px black
 * border, .modal-enter rise, .shadow-hard, p-6 md:p-8. Header pattern is a
 * mono badge + serif title + a 44px close button. Backdrop click and Escape
 * both close; focus is trapped inside while open and restored on close.
 */
export function Modal({
  open,
  onClose,
  label,
  badge,
  title,
  subtitle,
  maxWidth = 'max-w-lg',
  closeLabel = 'Close dialog',
  children,
}: ModalProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal bg-black/60 flex items-center justify-center p-4 backdrop-enter"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${maxWidth} bg-white border-2 border-black p-6 md:p-8 shadow-hard modal-enter max-h-[90vh] overflow-y-auto custom-scrollbar`}
      >
        <div className="flex items-center justify-between gap-3 pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3 min-w-0">
            {badge && (
              <span className="font-mono text-xs uppercase font-bold bg-black text-white px-2 py-0.5 shrink-0">
                {badge}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="font-serif text-lg font-bold tracking-tight text-black truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="w-11 h-11 shrink-0 flex items-center justify-center border border-black hover:bg-black hover:text-white transition-colors duration-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
