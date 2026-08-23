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
                 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={clsx(
          // On mobile: full-width sheet from bottom with rounded top corners
          // On sm+: centered dialog with all rounded corners
          'w-full sm:rounded-2xl rounded-t-2xl rounded-b-none sm:rounded-b-2xl',
          'card p-0 shadow-xl animate-slide-up overflow-hidden',
          // Max height: scrollable on small screens
          'max-h-[90vh] flex flex-col',
          sizeMap[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4
                          border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        )}
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
