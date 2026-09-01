'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/utils/api';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';

interface Settings {
  workingDate: string;
  adminWhatsapp: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthMatrix(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function ClockCalendar() {
  const [now, setNow] = useState(() => new Date());
  const [workingDate, setWorkingDate] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const ref = useRef<HTMLDivElement>(null);

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch working date
  useEffect(() => {
    api.get<{ success: boolean; data: Settings }>('/settings')
      .then((r) => setWorkingDate(r.data.data.workingDate || null))
      .catch(() => {});
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const wdParts = (workingDate ?? format(now, 'yyyy-MM-dd')).split('-').map(Number);
  const wdDate = new Date(wdParts[0], wdParts[1] - 1, wdParts[2]);
  const isWorkingReal = sameDay(wdDate, now);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });
  };

  const weeks = monthMatrix(view.y, view.m);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* pill trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all duration-150 hover:scale-[1.03] active:scale-95"
        style={{
          background: open ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
          <span className="font-mono text-sm font-bold text-white tabular-nums">
            {format(now, 'hh:mm:ss')}
            <span className="text-[10px] text-slate-500 ml-0.5 uppercase">{format(now, 'a')}</span>
          </span>
        </span>
        <span className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <span className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
          <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
            {isWorkingReal ? 'Today · ' : 'Working · '}
            {format(wdDate, 'dd MMM')}
            <span className="hidden lg:inline text-slate-500"> · {format(wdDate, 'yyyy')}</span>
          </span>
        </span>
      </button>

      {/* calendar popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-12 z-50 w-[300px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(8,8,28,0.97)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* top shimmer */}
            <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)' }} />

            {/* header: month nav */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-white">{format(new Date(view.y, view.m), 'MMMM yyyy')}</span>
              <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* weekday labels */}
            <div className="grid grid-cols-7 px-3 pt-3 pb-1">
              {WEEKDAYS.map((d) => (
                <span key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">{d}</span>
              ))}
            </div>

            {/* calendar grid */}
            <div className="px-3 pb-3">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1 my-0.5">
                  {week.map((d, di) => {
                    const todayCell = d !== null && view.y === now.getFullYear() && view.m === now.getMonth() && d === now.getDate();
                    const workCell = d !== null && view.y === wdParts[0] && view.m === wdParts[1] - 1 && d === wdParts[2];
                    return (
                      <div
                        key={di}
                        className={clsx(
                          'h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                          !d && 'opacity-0',
                          todayCell
                            ? 'text-white font-black'
                            : workCell
                              ? 'text-slate-100'
                              : 'text-slate-400',
                        )}
                        style={
                          todayCell
                            ? { background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 12px -2px rgba(99,102,241,0.7)' }
                            : workCell
                              ? { background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)' }
                              : undefined
                        }
                      >
                        {d}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* legend + working date footer */}
            <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }} />
                  Today
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ background: 'rgba(168,85,247,0.25)', border: '1px solid rgba(168,85,247,0.5)' }} />
                  Working date
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Working date: <span className="text-white font-semibold">{format(wdDate, 'EEEE, dd MMMM yyyy')}</span>
              </div>
              {!isWorkingReal && (
                <p className="text-[11px] text-amber-400/90">
                  Working date differs from the real date. You can change it in Settings &rarr; Working Date.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
