'use client';
import { clsx } from 'clsx';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

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
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={clsx(
        glass ? 'glass' : 'card',
        'p-6 animate-fade-in',
        glow && 'shadow-glow-sm',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

type StatColor = 'indigo'|'emerald'|'red'|'amber'|'purple'|'sky';

interface StatCardProps {
  title:      string;
  value:      string | number;
  icon?:      React.ReactNode;
  trend?:     { value: number; label: string };
  sparkline?: number[];
  color?:     StatColor;
  suffix?:    string;
}

const colorCfg: Record<StatColor, { icon: string; bg: string; border: string; stroke: string; glow: string }> = {
  indigo:  { icon: 'text-brand-500',   bg: 'bg-brand-500/10',   border: 'border-brand-500/20',   stroke: '#6366f1', glow: 'rgba(99,102,241,0.18)' },
  emerald: { icon: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', stroke: '#10b981', glow: 'rgba(16,185,129,0.18)' },
  red:     { icon: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     stroke: '#ef4444', glow: 'rgba(239,68,68,0.18)' },
  amber:   { icon: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   stroke: '#f59e0b', glow: 'rgba(245,158,11,0.18)' },
  purple:  { icon: 'text-purple-500',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  stroke: '#a855f7', glow: 'rgba(168,85,247,0.18)' },
  sky:     { icon: 'text-sky-500',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     stroke: '#0ea5e9', glow: 'rgba(14,165,233,0.18)' },
};

export function StatCard({ title, value, icon, trend, sparkline, color = 'indigo', suffix }: StatCardProps) {
  const cfg = colorCfg[color];
  const sparkData = sparkline?.map((v, i) => ({ i, v })) ?? [];

  return (
    <div className={clsx(
      'card p-5 relative overflow-hidden group',
      'hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200 animate-fade-in',
    )}>
      {/* Ambient glow */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${cfg.glow}, transparent)` }}
      />

      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center border', cfg.bg, cfg.border, cfg.icon)}>
          {icon}
        </div>
        {sparkData.length > 0 && (
          <div className="w-20 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={cfg.stroke} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={cfg.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ display: 'none' }}
                  cursor={false}
                />
                <Area
                  type="monotone" dataKey="v"
                  stroke={cfg.stroke} strokeWidth={1.5}
                  fill={`url(#sg-${color})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-1">
        {title}
      </p>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
        {suffix && <span className="text-sm font-semibold text-slate-400">{suffix}</span>}
      </div>
      {trend && (
        <p className={clsx(
          'mt-1.5 text-xs font-semibold flex items-center gap-1',
          trend.value >= 0 ? 'text-emerald-500' : 'text-red-400',
        )}>
          <span className="text-base leading-none">{trend.value >= 0 ? '↑' : '↓'}</span>
          {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
