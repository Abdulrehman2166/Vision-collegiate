'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/Card';
import { SectionLoader } from '@/components/ui/Loading';
import { AlertTriangle, Users, CheckCircle, XCircle, BookOpen } from 'lucide-react';
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

export default function DashboardPage() {
  const user = getUser();
  const [summary, setSummary]   = useState<AnalyticsSummary | null>(null);
  const [trend,   setTrend]     = useState<TrendPoint[]>([]);
  const [alerts,  setAlerts]    = useState<LowAttendanceAlert[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, trendRes, alertRes] = await Promise.all([
          api.get<ApiResponse<AnalyticsSummary>>('/analytics/attendance/today'),
          api.get<ApiResponse<TrendPoint[]>>('/analytics/attendance/trend?days=14'),
          api.get<ApiResponse<LowAttendanceAlert[]>>('/analytics/attendance/alerts?threshold=75'),
        ]);
        setSummary(sumRes.data.data);
        setTrend(trendRes.data.data);
        setAlerts(alertRes.data.data);
      } catch { /* handled by axios interceptor */ }
      finally  { setLoading(false); }
    }
    load();
  }, []);

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Good {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{today}</p>
      </div>

      {loading ? <SectionLoader /> : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <StatCard
              title="Total Students Marked"
              value={summary?.totalStudents ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              title="Present Today"
              value={summary?.presentToday ?? 0}
              icon={<CheckCircle className="w-5 h-5" />}
              color="green"
            />
            <StatCard
              title="Absent Today"
              value={summary?.absentToday ?? 0}
              icon={<XCircle className="w-5 h-5" />}
              color="red"
            />
            <StatCard
              title="Attendance %"
              value={`${summary?.attendancePercentage ?? 0}%`}
              icon={<BookOpen className="w-5 h-5" />}
              color={
                (summary?.attendancePercentage ?? 0) >= 80 ? 'green' :
                (summary?.attendancePercentage ?? 0) >= 60 ? 'yellow' : 'red'
              }
            />
          </div>

          {/* Trend chart */}
          <div className="card p-6 mb-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">
              14-Day Attendance Trend
            </h2>
            {trend.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="present" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="absent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), 'MMM d')}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    labelFormatter={(d) => format(new Date(d), 'MMM d, yyyy')}
                  />
                  <Area dataKey="present" name="Present" stroke="#3b82f6" fill="url(#present)" strokeWidth={2} dot={false} />
                  <Area dataKey="absent"  name="Absent"  stroke="#ef4444" fill="url(#absent)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Low-attendance alerts */}
          {alerts.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Low Attendance Alerts ({alerts.length})
                </h2>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 10).map((a) => (
                  <div
                    key={a.studentId}
                    className="flex items-center justify-between px-4 py-2.5
                               rounded-xl bg-yellow-50 dark:bg-yellow-900/10
                               border border-yellow-100 dark:border-yellow-800/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {a.studentName}
                        <span className="ml-2 text-xs text-slate-400">#{a.rollNumber}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{a.batchName}</p>
                    </div>
                    <span className="badge-red text-xs font-semibold">
                      {a.attendancePercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
