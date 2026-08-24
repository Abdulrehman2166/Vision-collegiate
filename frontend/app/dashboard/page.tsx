'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Loading';
import {
  Users, CheckCircle2, XCircle, TrendingUp, Clock,
  CalendarCheck, BookOpen, MessageSquare, FileDown, AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api, {
  type ApiResponse, type AnalyticsSummary,
  type TrendPoint, type LowAttendanceAlert,
} from '@/utils/api';
import { getUser } from '@/utils/auth';
import { format } from 'date-fns';
import Link from 'next/link';

// ─── Quick actions ─────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Mark Attendance', icon: CalendarCheck, href: '/attendance', color: 'from-brand-500 to-brand-600', glow: 'rgba(99,102,241,0.3)' },
  { label: 'Create Test',     icon: BookOpen,      href: '/tests',      color: 'from-purple-500 to-purple-700', glow: 'rgba(168,85,247,0.3)' },
  { label: 'WhatsApp Blast',  icon: MessageSquare, href: '/whatsapp',   color: 'from-emerald-500 to-emerald-600', glow: 'rgba(16,185,129,0.3)' },
  { label: 'Analytics',       icon: TrendingUp,    href: '/analytics',  color: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.3)' },
];

// ─── Stagger animation ──────────────────────────────────────────────────────
const stagger = {
  container: { animate: { transition: { staggerChildren: 0.07 } } },
  item: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16,1,0.3,1] } },
  },
};

export default function DashboardPage() {
  const user = getUser();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trend,   setTrend]   = useState<TrendPoint[]>([]);
  const [alerts,  setAlerts]  = useState<LowAttendanceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sumRes, trendRes, alertRes] = await Promise.all([
        api.get<ApiResponse<AnalyticsSummary>>('/analytics/attendance/today'),
        api.get<ApiResponse<TrendPoint[]>>('/analytics/attendance/trend?days=14'),
        api.get<ApiResponse<LowAttendanceAlert[]>>('/analytics/attendance/alerts?threshold=75'),
      ]);
      setSummary(sumRes.data.data);
      setTrend(trendRes.data.data);
      setAlerts(alertRes.data.data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pct = summary?.attendancePercentage ?? 0;
  const sparkPresent = trend.slice(-7).map(t => t.present);
  const sparkAbsent  = trend.slice(-7).map(t => t.absent);

  return (
    <AppShell>
      {/* ── Greeting ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-1 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Good {greeting()},{' '}
          <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-purple-500 bg-clip-text text-transparent">
            {user?.name?.split(' ')[0] ?? 'there'}
          </span>{' '}
          <span className="animate-float inline-block">👋</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1.5">
          Here&apos;s your institute overview for today.
        </p>
      </motion.div>

      {/* ── KPI cards ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={stagger.container}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <motion.div variants={stagger.item}>
            <StatCard
              title="Marked Today"
              value={summary?.totalStudents ?? 0}
              icon={<Users className="w-4.5 h-4.5" />}
              color="indigo"
              sparkline={sparkPresent}
            />
          </motion.div>
          <motion.div variants={stagger.item}>
            <StatCard
              title="Present"
              value={summary?.presentToday ?? 0}
              icon={<CheckCircle2 className="w-4.5 h-4.5" />}
              color="emerald"
              sparkline={sparkPresent}
              trend={{ value: 2, label: 'vs yesterday' }}
            />
          </motion.div>
          <motion.div variants={stagger.item}>
            <StatCard
              title="Absent"
              value={summary?.absentToday ?? 0}
              icon={<XCircle className="w-4.5 h-4.5" />}
              color="red"
              sparkline={sparkAbsent}
            />
          </motion.div>
          <motion.div variants={stagger.item}>
            <StatCard
              title="Attendance"
              value={`${pct}%`}
              icon={<TrendingUp className="w-4.5 h-4.5" />}
              color={pct >= 80 ? 'emerald' : pct >= 60 ? 'amber' : 'red'}
              sparkline={sparkPresent}
              trend={{ value: pct >= 75 ? 3 : -2, label: 'this week' }}
            />
          </motion.div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left col: Chart + Alerts ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Trend chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20
                              flex items-center justify-center text-brand-500">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Attendance Trend</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Last 14 days — Present vs Absent</p>
              </div>

              {/* Legend */}
              <div className="ml-auto flex items-center gap-4">
                {[{ color: '#6366f1', label: 'Present' }, { color: '#ef4444', label: 'Absent' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-[11px] font-semibold text-slate-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {trend.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-slate-400">No data yet — mark attendance to see trends</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 5, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.1)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => format(new Date(d), 'MMM d')}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(13,13,35,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(16px)',
                      fontSize: '12px',
                      color: '#f1f5f9',
                    }}
                    labelFormatter={d => format(new Date(d), 'MMM d, yyyy')}
                    cursor={{ stroke: 'rgba(99,102,241,0.25)', strokeWidth: 1 }}
                  />
                  <Area dataKey="present" name="Present" stroke="#6366f1" fill="url(#gP)" strokeWidth={2.5} dot={false} />
                  <Area dataKey="absent"  name="Absent"  stroke="#ef4444" fill="url(#gA)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Low-attendance alerts */}
          {alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="card p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20
                                flex items-center justify-center text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Low Attendance</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{alerts.length} students below 75%</p>
                </div>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 6).map((a, i) => (
                  <motion.div
                    key={a.studentId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: 0.05 * i }}
                    className="flex items-center justify-between px-3.5 py-3 rounded-xl
                               border border-amber-200/50 dark:border-amber-500/15
                               bg-amber-50/60 dark:bg-amber-500/[0.05]
                               hover:bg-amber-100/60 dark:hover:bg-amber-500/[0.08]
                               transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center
                                      text-amber-600 dark:text-amber-400 text-xs font-black flex-shrink-0">
                        {a.studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {a.studentName}
                          {a.rollNumber && <span className="ml-1.5 text-xs font-normal text-slate-400">#{a.rollNumber}</span>}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{a.batchName}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black
                        ${a.attendancePercent < 50
                          ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                        {a.attendancePercent}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right col: Quick actions ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="space-y-4"
        >
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="space-y-2.5">
              {QUICK_ACTIONS.map((action, i) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                  >
                    <Link
                      href={action.href}
                      className="flex items-center gap-3.5 p-3.5 rounded-xl
                                 border border-slate-200/60 dark:border-white/[0.06]
                                 hover:border-slate-300/80 dark:hover:border-white/[0.1]
                                 bg-slate-50/60 dark:bg-white/[0.02]
                                 hover:bg-white dark:hover:bg-white/[0.05]
                                 transition-all duration-150 group"
                    >
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.color}
                                       flex items-center justify-center flex-shrink-0`}
                           style={{ boxShadow: `0 4px 12px ${action.glow}` }}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300
                                       group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {action.label}
                      </span>
                      <svg className="w-4 h-4 ml-auto text-slate-300 dark:text-slate-700
                                      group-hover:text-slate-500 dark:group-hover:text-slate-400
                                      group-hover:translate-x-0.5 transition-all"
                           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Role info card */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                              flex items-center justify-center text-white font-black text-base shadow-glow-sm">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role}</p>
              </div>
            </div>
            <div className="glow-line" />
            <div className="mt-3 space-y-1.5">
              {[
                { label: 'Email', value: user?.email },
                { label: 'Access', value: user?.role === 'admin' ? 'Full Access' : user?.role === 'teacher' ? 'Teacher Access' : 'Limited Access' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate ml-2 max-w-[60%] text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
