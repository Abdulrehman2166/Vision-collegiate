import { clsx } from 'clsx';
import Image from 'next/image';

interface SpinnerProps { size?: 'sm'|'md'|'lg'; className?: string; light?: boolean; }
const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export function Spinner({ size = 'md', className, light }: SpinnerProps) {
  return (
    <div
      role="status" aria-label="Loading"
      className={clsx('rounded-full animate-spin', sizeMap[size], className)}
      style={{
        background: light
          ? 'conic-gradient(from 0deg, transparent 0%, #ffffff 80%, transparent 100%)'
          : 'conic-gradient(from 0deg, transparent 0%, #6366f1 80%, transparent 100%)',
        WebkitMask: 'radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2.5px))',
        mask:       'radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2.5px))',
      }}
    />
  );
}

export function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: 'linear-gradient(180deg, #04040f 0%, #06061a 100%)' }}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Real coaching logo */}
        <div className="relative">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center animate-float"
            style={{
              background: 'rgba(255,255,255,0.0)',
              boxShadow: '0 0 30px -6px rgba(99,102,241,0.55)',
            }}
          >
            <Image
              src="/logo.png"
              alt="Vision Collegiate"
              width={64}
              height={64}
              className="object-contain logo-blend"
              priority
            />
          </div>
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-2xl -z-10 scale-110 blur-md"
            style={{ background: 'linear-gradient(135deg, #6366f130, #a855f730)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm font-medium text-slate-500">Loading…</span>
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
