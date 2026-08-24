'use client';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`card animate-fade-in ${className ?? ''}`}
      style={{
        padding: '24px',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {children}
    </div>
  );
}

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

const colorMap: Record<StatColor, { color: string; bg: string; border: string; stroke: string; glow: string }> = {
  indigo:  { color:'#6366f1', bg:'rgba(99,102,241,0.12)',  border:'rgba(99,102,241,0.2)',  stroke:'#6366f1', glow:'rgba(99,102,241,0.15)'  },
  emerald: { color:'#10b981', bg:'rgba(16,185,129,0.12)',  border:'rgba(16,185,129,0.2)',  stroke:'#10b981', glow:'rgba(16,185,129,0.15)'  },
  red:     { color:'#ef4444', bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.2)',   stroke:'#ef4444', glow:'rgba(239,68,68,0.15)'   },
  amber:   { color:'#f59e0b', bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.2)',  stroke:'#f59e0b', glow:'rgba(245,158,11,0.15)'  },
  purple:  { color:'#a855f7', bg:'rgba(168,85,247,0.12)',  border:'rgba(168,85,247,0.2)',  stroke:'#a855f7', glow:'rgba(168,85,247,0.15)'  },
  sky:     { color:'#0ea5e9', bg:'rgba(14,165,233,0.12)',  border:'rgba(14,165,233,0.2)',  stroke:'#0ea5e9', glow:'rgba(14,165,233,0.15)'  },
};

export function StatCard({ title, value, icon, trend, sparkline, color = 'indigo', suffix }: StatCardProps) {
  const c = colorMap[color];
  const spark = sparkline?.map((v, i) => ({ i, v })) ?? [];
  return (
    <div
      className="card card-glow animate-fade-in"
      style={{ padding:'20px', position:'relative', overflow:'hidden', transition:'all 0.2s ease' }}
    >
      {/* Ambient top-right glow */}
      <div style={{
        position:'absolute', top:'-20px', right:'-20px',
        width:'80px', height:'80px', borderRadius:'50%',
        background:`radial-gradient(circle, ${c.glow}, transparent 70%)`,
        filter:'blur(20px)', pointerEvents:'none',
      }} />

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
        <div style={{
          width:'40px', height:'40px', borderRadius:'12px', flexShrink:0,
          background: c.bg, border:`1px solid ${c.border}`,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <span style={{ color: c.color }}>{icon}</span>
        </div>
        {spark.length > 0 && (
          <div style={{ width:'72px', height:'32px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.stroke} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ display:'none' }} cursor={false} />
                <Area type="monotone" dataKey="v" stroke={c.stroke} strokeWidth={1.5} fill={`url(#sg-${color})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#475569', marginBottom:'4px' }}>
        {title}
      </p>
      <div style={{ display:'flex', alignItems:'baseline', gap:'4px' }}>
        <span style={{ fontSize:'30px', fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.03em', lineHeight:1 }}>{value}</span>
        {suffix && <span style={{ fontSize:'13px', fontWeight:600, color:'#475569' }}>{suffix}</span>}
      </div>
      {trend && (
        <p style={{
          marginTop:'6px', fontSize:'12px', fontWeight:600,
          color: trend.value >= 0 ? '#10b981' : '#ef4444',
          display:'flex', alignItems:'center', gap:'4px',
        }}>
          <span style={{ fontSize:'14px', lineHeight:1 }}>{trend.value >= 0 ? '↑' : '↓'}</span>
          {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
