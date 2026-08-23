'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 sm:p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={clsx(
        'w-full sm:rounded-2xl rounded-t-3xl rounded-b-none sm:rounded-b-2xl',
        'max-h-[92vh] flex flex-col animate-slide-up',
        'border border-white/10 dark:border-white/[0.07]',
        'shadow-[0_25px_80px_rgba(0,0,0,0.5)]',
        'overflow-hidden',
        sizeMap[size],
        // background
        'bg-white dark:bg-[#111124]',
      )}>
        {title && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 flex-shrink-0
                          border-b border-slate-100 dark:border-white/[0.06]">
            {/* Accent line */}
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-brand-400 to-purple-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
                         hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-150"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
