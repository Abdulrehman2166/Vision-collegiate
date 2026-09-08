'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Loading';
import { PerformancePersona, type PerformanceStudent } from '@/components/students/PerformancePersona';
import { getUser } from '@/utils/auth';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { Target, BookOpen, CalendarCheck, Lock, Sparkles, UserRound } from 'lucide-react';

interface LinkedStudent {
  id: number;
  name: string;
  rollNumber: string | null;
  grade: string;
  stream: string | null;
}

interface ProgressResult {
  id: number;
  title: string;
  subject: string;
  date: string | null;
  marks: number;
  total: number;
  percent: number | null;
}

interface StudentProgress {
  persona: PerformanceStudent;
  results: ProgressResult[];
  attendanceTrend: { date: string; status: string }[];
}

const ATT_COLOR: Record<string, string> = {
  present: '#10b981',
  absent:  '#f43f5e',
  late:    '#f59e0b',
  leave:   '#38bdf8',
};

function scoreColor(pct: number | null): string {
  if (pct == null) return '#475569';
  if (pct >= 80) return '#f59e0b';
  if (pct >= 65) return '#a855f7';
  if (pct >= 45) return '#6366f1';
  return '#38bdf8';
}

export default function ProgressPage() {
  const router  = useRouter();
  const user    = getUser();

  const [students,   setStudents]   = useState<LinkedStudent[]>([]);
  const [activeId,   setActiveId]   = useState<number | null>(null);
  const [progress,   setProgress]   = useState<StudentProgress | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingP,   setLoadingP]   = useState(false);

  // Staff don't use the portal — they have the full Students personas grid
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'teacher')) router.replace('/students');
  }, [user, router]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: LinkedStudent[] }>('/students/linked');
        const list = res.data.data ?? [];
        setStudents(list);
        if (list.length) setActiveId(list[0].id);
      } catch {
        toast.error('Could not load your profile');
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setLoadingP(true);
    setProgress(null);
    (async () => {
      try {
        const res = await api.get<{ data: StudentProgress }>(`/students/${activeId}/performance`);
        setProgress(res.data.data);
      } catch {
        toast.error('Could not load progress data');
      } finally {
        setLoadingP(false);
      }
    })();
  }, [activeId]);

  const activeName = students.find((s) => s.id === activeId)?.name ?? '';

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Progress Portal</h1>
            <p className="text-sm text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Your personal performance universe — read only
            </p>
          </div>
          {students.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={[
                    'px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all flex-shrink-0',
                    activeId === s.id
                      ? 'text-white shadow-glow-sm'
                      : 'text-slate-400 hover:text-white',
                  ].join(' ')}
                  style={
                    activeId === s.id
                      ? { background: 'linear-gradient(135deg, #6366f126, #a855f710)', border: '1px solid #6366f166' }
                      : { border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  <UserRound className="w-3.5 h-3.5" /> {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadingList ? (
          <div className="card p-10 flex justify-center"><Spinner size="lg" /></div>
        ) : students.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-slate-400 text-sm">No student profile is linked to your account yet.</p>
            <p className="text-slate-600 text-xs mt-1">Ask the institute to link you, then refresh.</p>
          </div>
        ) : loadingP && !progress ? (
          <div className="card p-10 flex justify-center"><Spinner size="lg" /></div>
        ) : progress ? (
          <div className="flex flex-col gap-4">
            {/* Persona + rank */}
            <PerformancePersona students={[progress.persona]} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent performance */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                      <BookOpen className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Recent Performance</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        {progress.results.length} tests · latest first
                      </p>
                    </div>
                  </div>
                  {progress.results.length > 0 && (
                    <span className="hud-chip">AVG {Math.round(progress.results.reduce((a, r) => a + (r.percent ?? 0), 0) / progress.results.length)}%</span>
                  )}
                </div>

                {progress.results.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    No test results recorded yet — your marks will appear here after the first test.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                    {progress.results.map((r) => {
                      const c = scoreColor(r.percent);
                      return (
                        <div key={r.id} className="p-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{r.title || r.subject}</p>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                                {r.subject}{r.date ? ` · ${r.date}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-black tabular-nums flex-shrink-0" style={{ color: c }}>
                              {r.marks}/{r.total}
                              {r.percent != null && <span className="ml-1.5 text-slate-400 font-semibold">({r.percent}%)</span>}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full rounded-full progress-shimmer"
                              style={{ width: `${Math.min(100, Math.max(0, r.percent ?? 0))}%`, background: c }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attendance pulse */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <CalendarCheck className="w-4 h-4 text-emerald-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Attendance Pulse</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Last {progress.attendanceTrend.length} school days</p>
                    </div>
                  </div>
                </div>

                {progress.attendanceTrend.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">
                    No attendance recorded yet — your daily pulse will appear here.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {progress.attendanceTrend.map((d) => {
                        const c = ATT_COLOR[d.status] ?? '#334155';
                        return (
                          <div key={d.date} title={`${d.date} · ${d.status}`}
                            className="aspect-square rounded-md flex items-center justify-center"
                            style={{ background: `${c}2a`, border: `1px solid ${c}44`, color: c }}>
                            <span className="text-[9px] font-black">{Number(d.date.slice(8, 10))}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} /> Present</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /> Late</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f43f5e' }} /> Absent</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} /> Leave</span>
                    </div>
                  </>
                )}

                <div className="mt-5 p-3 rounded-xl flex items-center gap-2.5"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
                  <p className="text-xs text-slate-300">
                    <span className="font-bold text-amber-300">{activeName}</span> ·
                    Showing {progress.persona.testsTaken} test{progress.persona.testsTaken === 1 ? '' : 's'} and {progress.attendanceTrend.length} attendance day{progress.attendanceTrend.length === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="icon-chip w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #06b6d426, #a855f71a)', border: '1px solid #06b6d655' }}>
                <Target className="w-4 h-4 text-cyan-300" />
              </div>
              <p className="text-xs text-slate-400">
                <span className="text-white font-bold">Performance IQ</span> blends attendance consistency and test averages into a
                single live score. Tier rank is computed against every active student.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}