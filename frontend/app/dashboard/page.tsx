'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/Card';
import { SectionLoader } from '@/components/ui/Loading';
import { AlertTriangle, Users, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api, { type ApiResponse, type AnalyticsSummary, type TrendPoint, type LowAttendanceAlert } from '@/utils/api';
import { getUser } from '@/utils/auth';
import { format } from 'date-fns';

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

  const today = format(new Date(), 'EEEE, MMMM d');
  const pct   = summary?.attendancePercentage ?? 0;

  return (
    <AppShell>
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-1">
              {today}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Good {getGreeting()},{' '}
              <span className="bg-gradient-to-r from-brand-500 to-purple-500 bg-clip-text text-transparent">
                {user?.name?.split(' ')[0] ?? 'there'}
              </span>{' '}
              👋
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              Here&apos;s what&apos;s happening at your institute today.
            </p>
          </div>
        </div>
      </div>

      {loading ? <SectionLoader /> : (
        <div className="space-y-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Marked Today"
              value={summary?.totalStudents ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="indigo"
            />
            <StatCard
              title="Present"
              value={summary?.presentToday ?? 0}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="green"
            />
            <StatCard
              title="Absent"
              value={summary?.absentToday ?? 0}
              icon={<XCircle className="w-5 h-5" />}
              color="red"
            />
            <StatCard
              title="Attendance"
              value={`${pct}%`}
              icon={<TrendingUp className="w-5 h-5" />}
              color={pct >= 80 ? 'green' : pct >= 60 ? 'yellow' : 'red'}
            />
          </div>

          {/* ── Trend chart ── */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-brand-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">14-Day Attendance Trend</h2>
                <p className="text-xs text-slate-400">Present vs Absent over the last 2 weeks</p>
              </div>
            </div>

            {trend.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm text-slate-400">No data yet — mark attendance to see trends</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), 'MMM d')}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,15,30,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(16px)',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                    labelFormatter={(d) => format(new Date(d), 'MMM d, yyyy')}
                    cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }}
                  />
                  <Area dataKey="present" name="Present" stroke="#6366f1" fill="url(#gPresent)" strokeWidth={2.5} dot={false} />
                  <Area dataKey="absent"  name="Absent"  stroke="#ef4444" fill="url(#gAbsent)"  strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Low-attendance alerts ── */}
          {alerts.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Low Attendance Alerts
                  </h2>
                  <p className="text-xs text-slate-400">{alerts.length} students below 75%</p>
                </div>
              </div>

              <div className="space-y-2">
                {alerts.slice(0, 8).map((a) => (
                  <div
                    key={a.studentId}
                    className="flex items-center justify-between px-4 py-3 rounded-xl
                               border border-amber-200/60 dark:border-amber-500/15
                               bg-amber-50/50 dark:bg-amber-500/[0.05]
                               hover:bg-amber-100/50 dark:hover:bg-amber-500/[0.08]
                               transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center
                                      text-amber-600 dark:text-amber-400 text-xs font-black flex-shrink-0">
                        {a.studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {a.studentName}
                          {a.rollNumber && (
                            <span className="ml-2 text-xs font-normal text-slate-400">#{a.rollNumber}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 truncate">{a.batchName}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold
                        ${a.attendancePercent < 50
                          ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        }`}>
                        {a.attendancePercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
