'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { SectionLoader } from '@/components/ui/Loading';
import { AlertTriangle, TrendingUp, BarChart2, Users } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';
import { format } from 'date-fns';
import api, {
  type ApiResponse,
  type TrendPoint,
  type LowAttendanceAlert,
} from '@/utils/api';

interface BatchSummary {
  batchId: number;
  batchName: string;
  grade: string;
  stream: string | null;
  totalStudents: number;
  averageAttendance: number;
}

interface HeatmapDay { date: string; present: number; }

export default function AnalyticsPage() {
  const [trend,    setTrend]    = useState<TrendPoint[]>([]);
  const [alerts,   setAlerts]   = useState<LowAttendanceAlert[]>([]);
  const [batches,  setBatches]  = useState<BatchSummary[]>([]);
  const [heatmap,  setHeatmap]  = useState<HeatmapDay[]>([]);
  const [threshold, setThreshold] = useState(75);
  const [days,    setDays]     = useState(30);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [trendRes, alertRes, batchRes, heatRes] = await Promise.all([
          api.get<ApiResponse<TrendPoint[]>>(`/analytics/attendance/trend?days=${days}`),
          api.get<ApiResponse<LowAttendanceAlert[]>>(`/analytics/attendance/alerts?threshold=${threshold}`),
          api.get<ApiResponse<BatchSummary[]>>('/analytics/batches/summary'),
          api.get<ApiResponse<HeatmapDay[]>>('/analytics/attendance/heatmap?days=90'),
        ]);
        setTrend(trendRes.data.data);
        setAlerts(alertRes.data.data);
        setBatches(batchRes.data.data);
        setHeatmap(heatRes.data.data);
      } catch { /* handled */ }
      finally { setLoading(false); }
    }
    load();
  }, [days, threshold]);

  // Compute max present for heatmap colour scale
  const maxPresent = Math.max(...heatmap.map((d) => d.present), 1);

  function heatColor(value: number) {
    const pct = value / maxPresent;
    if (pct === 0)   return '#f1f5f9';
    if (pct < 0.25)  return '#bfdbfe';
    if (pct < 0.5)   return '#60a5fa';
    if (pct < 0.75)  return '#3b82f6';
    return '#1d4ed8';
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Attendance trends and insights</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-end mt-2 sm:mt-0">
          <div>
            <label className="label text-xs">Trend period</label>
            <select className="select w-28 text-xs" value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
              {[7,14,30,60,90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Alert threshold</label>
            <select className="select w-28 text-xs" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))}>
              {[60,65,70,75,80].map((t) => <option key={t} value={t}>Below {t}%</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? <SectionLoader /> : (
        <div className="space-y-6">

          {/* Trend chart */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {days}-Day Attendance Trend
              </h2>
            </div>
            {trend.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} barSize={14} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => {
                      const s = String(v ?? '');
                      if (!s) return '';
                      try { return format(new Date(s as string), 'MMM d'); } catch { return ''; }
                    }}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    labelFormatter={(v) => {
                      const s = String(v ?? '');
                      if (!s) return '';
                      try { return format(new Date(s as string), 'MMM d, yyyy'); } catch { return ''; }
                    }}
                  />
                  <Legend />
                  <Bar dataKey="present" name="Present" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="absent"  name="Absent"  fill="#f87171" radius={[4,4,0,0]} />
                  <Bar dataKey="late"    name="Late"    fill="#fbbf24" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Batch averages */}
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 className="w-5 h-5 text-brand-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Batch Averages</h2>
              </div>
              {batches.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No data</p>
              ) : (
                <div className="space-y-3">
                  {batches.map((b) => (
                    <div key={b.batchId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{b.batchName}</span>
                        <span className={
                          b.averageAttendance >= 80 ? 'text-green-600 dark:text-green-400 font-semibold' :
                          b.averageAttendance >= 65 ? 'text-yellow-600 dark:text-yellow-400 font-semibold' :
                          'text-red-600 dark:text-red-400 font-semibold'
                        }>
                          {b.averageAttendance}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={
                            b.averageAttendance >= 80 ? 'h-full bg-green-500 rounded-full' :
                            b.averageAttendance >= 65 ? 'h-full bg-yellow-500 rounded-full' :
                            'h-full bg-red-500 rounded-full'
                          }
                          style={{ width: `${b.averageAttendance}%`, transition: 'width 0.5s ease' }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {b.totalStudents} students · Grade {b.grade}{b.stream ? ' – ' + b.stream : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Low attendance alerts */}
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Low Attendance ({alerts.length})
                </h2>
              </div>
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No students below {threshold}% 🎉
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {alerts.map((a) => (
                    <div key={a.studentId}
                         className="flex items-center justify-between px-3 py-2.5 rounded-xl
                                    bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {a.studentName}
                          {a.rollNumber && <span className="ml-2 text-xs text-slate-400">#{a.rollNumber}</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{a.batchName}</p>
                      </div>
                      <span className="badge-red font-semibold">{a.attendancePercent}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Attendance heatmap */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-5 h-5 text-brand-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                90-Day Attendance Heatmap
              </h2>
            </div>
            {heatmap.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No data</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {heatmap.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.present} present`}
                      className="w-5 h-5 rounded-sm cursor-default transition-transform hover:scale-125"
                      style={{ backgroundColor: heatColor(d.present) }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
                  <span>Less</span>
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                    <div key={pct} className="w-4 h-4 rounded-sm"
                         style={{ backgroundColor: heatColor(Math.round(pct * maxPresent)) }} />
                  ))}
                  <span>More</span>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
