'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open:     boolean;
  onClose:  () => void;
  title?:   string;
  children: React.ReactNode;
  size?:    'sm'|'md'|'lg'|'xl';
  description?: string;
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, size = 'md', description }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}
    >
      <div className={clsx(
        'w-full max-h-[92vh] flex flex-col animate-slide-up',
        'rounded-t-3xl sm:rounded-2xl overflow-hidden',
        sizeMap[size],
        // dark glass
        'bg-white dark:bg-[#111128]',
        'border border-slate-200/60 dark:border-white/[0.07]',
        'shadow-modal',
      )}>
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
        </div>

        {title && (
          <div className="flex items-start justify-between px-5 sm:px-6 py-4 flex-shrink-0
                          border-b border-slate-200/60 dark:border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2.5">
                {/* Accent bar */}
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-brand-400 to-purple-500 flex-shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
              </div>
              {description && (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-600 ml-3.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
                         hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all ml-2 flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
