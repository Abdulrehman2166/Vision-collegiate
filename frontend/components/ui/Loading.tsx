import { clsx } from 'clsx';

interface SpinnerProps { size?: 'sm'|'md'|'lg'; className?: string; }
const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      role="status" aria-label="Loading"
      className={clsx('rounded-full animate-spin', sizeMap[size], className)}
      style={{
        background: 'conic-gradient(from 0deg, transparent 0%, #6366f1 80%, transparent 100%)',
        WebkitMask: 'radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2.5px))',
        mask:       'radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2.5px))',
      }}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0a0a1e]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600
                          flex items-center justify-center shadow-glow animate-float">
            <span className="text-2xl font-black text-white select-none">V</span>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600
                          opacity-25 blur-lg -z-10 scale-110" />
        </div>
        <div className="flex items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm font-medium text-slate-400 dark:text-slate-600">Loading…</span>
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

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-fade-in">
      <div className="skeleton h-3 w-24 rounded-full" />
      <div className="skeleton h-8 w-16 rounded-xl" />
      <div className="skeleton h-2 w-32 rounded-full" />
    </div>
  );
}
