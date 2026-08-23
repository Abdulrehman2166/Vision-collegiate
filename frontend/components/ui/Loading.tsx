import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        'rounded-full animate-spin',
        sizeMap[size],
        className,
      )}
      style={{
        background: 'conic-gradient(from 0deg, transparent 0deg, #6366f1 360deg)',
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
      }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#08081a]">
      <div className="flex flex-col items-center gap-5">
        {/* Logo mark */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600
                          flex items-center justify-center shadow-glow animate-float">
            <span className="text-2xl font-black text-white">V</span>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600
                          opacity-20 blur-md -z-10" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 dark:text-slate-500 font-medium">Loading…</p>
        </div>
      </div>
    </div>
  );
}

export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  );
}
