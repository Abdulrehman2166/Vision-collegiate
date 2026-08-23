import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, glass = false, glow = false, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        glass ? 'glass-card' : 'card',
        'p-6 animate-fade-in',
        glow && 'dark:shadow-glow-sm',
        onClick && 'cursor-pointer hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo';
  gradient?: boolean;
}

const colorConfig = {
  blue:   { icon: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   glow: 'rgba(59,130,246,0.2)' },
  green:  { icon: 'text-emerald-500',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',glow: 'rgba(16,185,129,0.2)' },
  red:    { icon: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    glow: 'rgba(239,68,68,0.2)' },
  yellow: { icon: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  glow: 'rgba(245,158,11,0.2)' },
  purple: { icon: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'rgba(168,85,247,0.2)' },
  indigo: { icon: 'text-brand-500',  bg: 'bg-brand-500/10',  border: 'border-brand-500/20',  glow: 'rgba(99,102,241,0.2)' },
};

export function StatCard({ title, value, icon, trend, color = 'indigo' }: StatCardProps) {
  const cfg = colorConfig[color];

  return (
    <div className={clsx(
      'card p-5 relative overflow-hidden group',
      'hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200',
      'animate-fade-in',
    )}>
      {/* Subtle gradient glow in corner */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl pointer-events-none"
        style={{ background: cfg.glow }}
      />

      <div className="flex items-start justify-between relative">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-2">
            {title}
          </p>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {value}
          </p>
          {trend && (
            <p className={clsx(
              'mt-1.5 text-xs font-semibold flex items-center gap-1',
              trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
            )}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={clsx(
            'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
            cfg.bg, cfg.icon,
            'border', cfg.border,
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
