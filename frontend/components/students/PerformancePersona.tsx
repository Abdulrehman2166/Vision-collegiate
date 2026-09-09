'use client';

import { motion } from 'framer-motion';
import { Flame, CalendarCheck, BookOpen, Trophy, Cpu, TrendingUp } from 'lucide-react';

export interface PerformanceStudent {
  studentId: number;
  name: string;
  rollNumber: string | null;
  grade: string;
  stream: string | null;
  batchName: string | null;
  attendancePercent: number | null;
  testPercent: number | null;
  testsTaken: number;
  performanceIQ: number;
  tier: 'S' | 'A' | 'B' | 'C';
  tierColor: string;
  rank: number;
  streak: number;
  role: string;
  roleIcon: string;
  lastTestDate: string | null;
}

const TIER_LABEL: Record<PerformanceStudent['tier'], string> = {
  S: 'ELITE',
  A: 'ADVANCED',
  B: 'PROGRESSING',
  C: 'DEVELOPING',
};

/** Animated circular IQ ring. */
function IQRing({ value, color }: { value: number; color: string }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
      <defs>
        <linearGradient id={`iqGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
      <motion.circle
        cx="44" cy="44" r={R} fill="none"
        stroke={`url(#iqGrad-${color.replace('#', '')})`}
        strokeWidth="6" strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - value / 100) }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}90)` }}
      />
      <text x="44" y="42" textAnchor="middle" dominantBaseline="central"
        className="fill-white" style={{ fontSize: '12px', fontWeight: 800, filter: `drop-shadow(0 0 6px ${color})` }}>
        {value}
      </text>
      <text x="44" y="60" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: '6px', fontWeight: 700, letterSpacing: '0.2em', fill: color }}>
        IQ
      </text>
    </svg>
  );
}

function MeterBar({ label, value, color, icon }: { label: string; value: number | null; color: string; icon: React.ReactNode }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
        <span className="flex items-center gap-1 text-slate-400 uppercase tracking-widest">
          {icon}{label}
        </span>
        <span style={{ color }}>{value == null ? '—' : `${v}%`}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}55, ${color})`, boxShadow: `0 0 8px ${color}80` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, v)}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        />
      </div>
    </div>
  );
}

export function PerformancePersona({ students }: { students: PerformanceStudent[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {students.map((s, i) => (
        <motion.div
          key={s.studentId}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="card p-5 flex flex-col gap-4"
          style={{ borderColor: `${s.tierColor}30` }}
        >
          {/* Top scanline */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.tierColor}90, transparent)` }} />

          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar with tier ring */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black"
                  style={{
                    background: `linear-gradient(135deg, ${s.tierColor}33, ${s.tierColor}14)`,
                    border: `1px solid ${s.tierColor}55`,
                    boxShadow: `0 0 18px -4px ${s.tierColor}80`,
                    color: s.tierColor,
                  }}
                >
                  {s.roleIcon}
                </div>
                <span className="absolute -right-1 -top-1 w-3 h-3 rounded-full status-dot" style={{ background: s.tierColor, border: '2px solid #0d0d28' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{s.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {s.rollNumber ? `#${s.rollNumber} · ` : ''}{s.batchName ?? `Grade ${s.grade}`}
                </p>
              </div>
            </div>
            {/* Rank badge */}
            <div
              className="flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1"
              style={{
                background: `${s.tierColor}14`,
                border: `1px solid ${s.tierColor}40`,
                color: s.tierColor,
                boxShadow: `0 0 14px -4px ${s.tierColor}70`,
              }}
            >
              <Trophy className="w-3 h-3" /> #{s.rank}
            </div>
          </div>

          {/* IQ ring + tier */}
          <div className="flex items-center justify-between">
            <IQRing value={s.performanceIQ} color={s.tierColor} />
            <div className="flex flex-col items-end gap-2">
              <span className="hud-chip" style={{ color: s.tierColor, borderColor: `${s.tierColor}50`, background: `${s.tierColor}12`, boxShadow: `0 0 16px -4px ${s.tierColor}80` }}>
                <Cpu className="w-3 h-3" /> {TIER_LABEL[s.tier]}
              </span>
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: s.tierColor }} />
                {s.role}
              </span>
            </div>
          </div>

          {/* Meters */}
          <div className="flex flex-col gap-3">
            <MeterBar label="Attendance" value={s.attendancePercent} color="#10b981" icon={<CalendarCheck className="w-3 h-3" />} />
            <MeterBar label="Academics" value={s.testPercent} color="#38bdf8" icon={<BookOpen className="w-3 h-3" />} />
          </div>

          {/* Footer chips */}
          <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="flex items-center gap-1 text-[11px] font-bold text-orange-400">
              <Flame className="w-3.5 h-3.5" /> {s.streak} day streak
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {s.testsTaken} test{s.testsTaken === 1 ? '' : 's'}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}