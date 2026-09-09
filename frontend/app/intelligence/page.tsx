'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Loading';
import api, { type ApiResponse, type Batch } from '@/utils/api';
import { getUser } from '@/utils/auth';
import toast from 'react-hot-toast';
import { Brain, TrendingUp, TrendingDown, Activity, AlertTriangle, RefreshCw, Sigma, Target, BarChart3, Weight } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ReferenceLine, Legend, ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';

interface ForecastPoint { date: string; pct: number; total: number }
interface ForecastPointP { date: string; pct: number }
interface WeekBucket { label: string; pct: number }
interface Regression { slope: number; intercept: number; r2: number }

interface ForecastShape {
  series: ForecastPoint[];
  forecast: ForecastPointP[];
  weekBuckets: WeekBucket[];
  regression: Regression;
  direction: 'rising' | 'declining' | 'stable';
}

interface DistribShape {
  sampleSize: number; mean: number; median: number;
  p10: number; p25: number; p75: number; p90: number; stdDev: number;
  buckets: { label: string; count: number; color: string }[];
}

interface CorrShape {
  r: number; t: number; n: number; significant: boolean;
  strength: 'weak' | 'moderate' | 'strong';
  scatter: { name: string; attendance: number; academic: number }[];
}

interface AtRiskShape {
  studentId: number; name: string; rollNumber: string; batchName: string;
  risk: number; level: 'critical' | 'high' | 'watch';
  attendance: number; average: number; slope: number; testsTaken: number;
  reasons: string[];
}

const RISK_COLORS: Record<string, string> = { critical: '#f43f5e', high: '#f59e0b', watch: '#eab308' };
const RISK_LEVELS: Record<string, string> = { critical: 'badge-red', high: 'badge-yellow', watch: 'badge-yellow' };

const HIST_COLORS = ['#f43f5e', '#f97316', '#f59e0b', '#facc15', '#a3e635', '#4ade80', '#22d3ee', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'];

export default function IntelligencePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [days, setDays] = useState(30);

  const [forecast, setForecast] = useState<ForecastShape | null>(null);
  const [distrib, setDistrib] = useState<DistribShape | null>(null);
  const [corr, setCorr] = useState<CorrShape | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskShape[]>([]);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(getUser() ?? undefined);
  const allowed = user && (user.role === 'admin' || user.role === 'teacher');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = batchId ? `&batchId=${batchId}` : '';
      const [f, d, c, r] = await Promise.all([
        api.get<ApiResponse<ForecastShape>>(`/analytics/intelligence/forecast?days=${days}${q}`),
        api.get<ApiResponse<DistribShape>>(`/analytics/intelligence/performance-distribution${q}`),
        api.get<ApiResponse<CorrShape>>(`/analytics/intelligence/correlation${q}`),
        api.get<ApiResponse<AtRiskShape[]>>(`/analytics/intelligence/at-risk${q}`),
      ]);
      setForecast(f.data.data);
      setDistrib(d.data.data);
      setCorr(c.data.data);
      setAtRisk(r.data.data);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to load intelligence');
    } finally { setLoading(false); }
  }, [batchId, days]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches')
      .then((r) => setBatches(r.data.data.filter((b) => b.is_active)))
      .catch(() => {});
  }, []);

  if (!allowed) {
    return (
      <AppShell>
        <div className="card p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white">Restricted</h1>
          <p className="text-sm text-slate-400 mt-1">Only admins and teachers can access the Intelligence Lab.</p>
        </div>
      </AppShell>
    );
  }

  const forecastChart = forecast
    ? [
        ...forecast.series.map((s) => ({ date: s.date.slice(5), actual: s.pct })),
        ...forecast.forecast.map((f) => ({ date: f.date.slice(5), projected: f.pct })),
      ]
    : [];

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-6 h-6 text-cyan-400" /> Intelligence Lab
            </h1>
            <p className="text-sm text-slate-400">Forecasting, distributions, correlation & risk — computed live</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="select w-52" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All batches</option>
              {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name} — {b.grade}{b.stream ? ` (${b.stream})` : ''}</option>)}
            </select>
            <select className="select w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Run</button>
          </div>
        </div>

        {loading || !forecast ? (
          <div className="card p-10 flex justify-center"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* Row 1: Forecast + Regression summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(217,70,239,0.1)', border: '1px solid rgba(217,70,239,0.3)' }}>
                      <Activity className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Attendance Forecast</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">OLS regression · next 7 days · R² {forecast.regression.r2}</p>
                    </div>
                  </div>
                  <span className={`hud-chip ${forecast.direction === 'rising' ? '!text-emerald-300' : forecast.direction === 'declining' ? '!text-red-400' : '!text-amber-300'}`}>
                    {forecast.direction === 'rising' ? <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> : <TrendingDown className="w-3.5 h-3.5 inline mr-1" />}
                    {forecast.direction}
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastChart}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
<stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} interval={4} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <RTooltip contentStyle={{ background: 'rgba(10,10,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v, n) => [`${String(v)}%`, String(n) === 'actual' ? 'Actual' : 'Projected']} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                      <ReferenceLine y={85} stroke="rgba(148,163,184,0.25)" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="actual" name="actual" stroke="#38bdf8" strokeWidth={2} fill="url(#gA)" connectNulls />
                      <Area type="monotone" dataKey="projected" name="projected" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" fill="url(#gP)" connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="card p-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Regression Fit</h3>
                  <div className="space-y-2.5">
                    <RegLine label="Slope (per day)" value={`${forecast.regression.slope}%/day`} icon={<TrendingUp className="w-3.5 h-3.5" />} color="#38bdf8" />
                    <RegLine label="Intercept" value={String(forecast.regression.intercept)} icon={<Target className="w-3.5 h-3.5" />} color="#38bdf8" />
                    <RegLine label="R² goodness-of-fit" value={String(forecast.regression.r2)} icon={<Sigma className="w-3.5 h-3.5" />} color="#10b981" />
                  </div>
                </div>
                <div className="card p-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Weekly Averages</h3>
                  <div className="flex items-end gap-1.5 h-20 mb-3">
                    {forecast.weekBuckets.map((w, i) => (
                      <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t" style={{ height: `${Math.max(3, w.pct)}%`, background: `linear-gradient(180deg, rgba(56,189,248,0.9), rgba(217,70,239,0.7))` }} />
                        <span className="text-[9px] text-slate-500">{w.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">{forecast.weekBuckets.length} weeks of history</p>
                </div>
              </div>
            </div>

            {/* Row 2: Distribution + Correlation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <BarChart3 className="w-4 h-4 text-slate-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Score Distribution</h2>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{distrib?.sampleSize ?? 0} students · mean {distrib?.mean ?? '—'} · median {distrib?.median ?? '—'} · σ {distrib?.stdDev ?? '—'}</p>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distrib?.buckets ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <RTooltip contentStyle={{ background: 'rgba(10,10,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${String(v)} students`, 'in % band']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} name="students">
                        {distrib?.buckets.map((b, i) => <Cell key={b.label} fill={HIST_COLORS[i % HIST_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {distrib && (
                  <div className="grid grid-cols-5 gap-1.5 mt-3">
                    <Pct label="P10" v={distrib.p10} c="#f43f5e" />
                    <Pct label="P25" v={distrib.p25} c="#f97316" />
                    <Pct label="Median" v={distrib.median} c="#f59e0b" />
                    <Pct label="P75" v={distrib.p75} c="#10b981" />
                    <Pct label="P90" v={distrib.p90} c="#38bdf8" />
                  </div>
                )}
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <Weight className="w-4 h-4 text-emerald-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Attendance ↔ Marks Correlation</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Pearson r on {corr?.n ?? 0} students</p>
                    </div>
                  </div>
                  <div className="hud-chip" style={{ color: corr?.significant ? '#34d399' : '#94a3b8' }}>
                    {corr ? (corr.significant ? `significant · ${corr.strength}` : 'not significant') : ''}
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" dataKey="attendance" name="Attendance %" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} label={{ value: 'Attendance %', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 9 }} />
                      <YAxis type="number" dataKey="academic" name="Marks %" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                      <ZAxis range={[60, 60]} />
                      <RTooltip contentStyle={{ background: 'rgba(10,10,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [`${String(v)}%`, String(n)]} labelFormatter={(l) => `${(l as { name?: string }).name ?? ''}`} wrapperStyle={{ pointerEvents: 'none' }} />
                      <Scatter data={corr?.scatter ?? []} fill="rgba(56,189,248,0.6)" />
                      <ReferenceLine segment={corr && corr.scatter.length > 1 ? trendLine(corr.scatter) : [{ x: 0, y: 50 }, { x: 100, y: 50 }]} stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {corr && (
                  <div className="flex items-center justify-between text-xs mt-3">
                    <span className="text-slate-400">r = <b className="text-cyan-300 tabular-nums">{corr.r}</b> · t = <b className="text-cyan-300 tabular-nums">{corr.t}</b></span>
                    <span className="text-slate-500">n = {corr.n}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: At-risk students */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">At-Risk Engine</h2>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Attendance · averages · performance trend</p>
                </div>
                <div className="ml-auto flex gap-1">
                  {(['critical', 'high', 'watch'] as const).map((lvl) => {
                    const c = atRisk.filter((s) => s.level === lvl).length;
                    return <span key={lvl} className={`badge ${RISK_LEVELS[lvl]}`}>{c} {lvl}</span>;
                  })}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/[0.07]">
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Student</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Level</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 w-56">Risk Gauge</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 w-72">Drivers</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Attend.</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Avg</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {atRisk.map((s) => (
                      <tr key={s.studentId}>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-100">{s.name}{s.rollNumber && <span className="ml-1 text-[10px] text-slate-500">#{s.rollNumber}</span>}</p>
                          <p className="text-[10px] text-slate-500">{s.batchName}</p>
                        </td>
                        <td className="px-3 py-2.5"><span className={`badge ${RISK_LEVELS[s.level]}`}>{s.level}</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${s.risk}%`, background: `linear-gradient(90deg, #22c55e, ${RISK_COLORS[s.level]})` }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{ color: RISK_COLORS[s.level] }}>{s.risk}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {s.reasons.map((r) => <span key={r} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${RISK_COLORS[s.level]}14`, border: `1px solid ${RISK_COLORS[s.level]}33`, color: RISK_COLORS[s.level] }}>{r}</span>)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-400 tabular-nums">{s.attendance}%</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-400 tabular-nums">{s.average}%</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: s.slope < 0 ? '#f87171' : '#34d399' }}>{s.slope}%/t</td>
                      </tr>
                    ))}
                    {atRisk.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500 text-sm">No students flagged at risk. Outstanding.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function RegLine({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-xs text-slate-500"><span style={{ color }}>{icon}</span>{label}</span>
      <span className="text-xs font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}

function Pct({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div className="text-center p-1.5 rounded-lg" style={{ background: `${c}12`, border: `1px solid ${c}30` }}>
      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-sm font-black tabular-nums" style={{ color: c }}>{v}%</p>
    </div>
  );
}

function trendLine(pts: { attendance: number; academic: number }[]): [{ x: number; y: number }, { x: number; y: number }] {
  const n = pts.length;
  if (n < 2) return [{ x: 0, y: 50 }, { x: 100, y: 50 }];
  const mx = pts.reduce((a, p) => a + p.attendance, 0) / n;
  const my = pts.reduce((a, p) => a + p.academic, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.attendance - mx) * (p.academic - my); den += (p.attendance - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const b = my - slope * mx;
  return [{ x: 0, y: b }, { x: 100, y: slope * 100 + b }];
}