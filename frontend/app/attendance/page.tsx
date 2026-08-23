'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SectionLoader } from '@/components/ui/Loading';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Clock, Send, FileDown, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import api, { type ApiResponse, type Batch, type AttendanceRecord } from '@/utils/api';

type Status = 'present' | 'absent' | 'late' | 'holiday';

interface GridRow {
  studentId:   number;
  studentName: string;
  rollNumber:  string;
  status:      Status;
}

const statusConfig: Record<Status, { label: string; icon: React.ReactNode; cls: string }> = {
  present: { label: 'P',  icon: <CheckCircle2 className="w-4 h-4" />, cls: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  absent:  { label: 'A',  icon: <XCircle      className="w-4 h-4" />, cls: 'bg-red-100   text-red-700   border-red-300   dark:bg-red-900/30   dark:text-red-400   dark:border-red-700' },
  late:    { label: 'L',  icon: <Clock        className="w-4 h-4" />, cls: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  holiday: { label: 'H',  icon: null,                                  cls: 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600' },
};
const statuses: Status[] = ['present', 'absent', 'late', 'holiday'];

export default function AttendancePage() {
  const [batches,      setBatches]    = useState<Batch[]>([]);
  const [batchId,      setBatchId]    = useState('');
  const [date,         setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [grid,         setGrid]       = useState<GridRow[]>([]);
  const [loading,      setLoading]    = useState(false);
  const [submitting,   setSubmitting] = useState(false);
  const [existing,     setExisting]   = useState<AttendanceRecord[]>([]);
  const [pdfUrl,       setPdfUrl]     = useState('');

  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches?active=true')
      .then((r) => {
        setBatches(r.data.data);
        if (r.data.data.length) setBatchId(String(r.data.data[0].id));
      })
      .catch(() => {});
  }, []);

  const fetchGrid = useCallback(async () => {
    if (!batchId || !date) return;
    setLoading(true);
    setPdfUrl('');
    try {
      // Load students in the batch
      const studRes  = await api.get<ApiResponse<{ id: number; name: string; roll_number: string }[]>>(
        `/students?batchId=${batchId}&limit=200`,
      );
      // Load existing attendance for this date
      const attRes   = await api.get<ApiResponse<AttendanceRecord[]>>(
        `/attendance/batch/${batchId}?date=${date}`,
      );
      setExisting(attRes.data.data);

      const attMap = new Map(attRes.data.data.map((a) => [a.student_id, a.status as Status]));

      setGrid(
        studRes.data.data.map((s) => ({
          studentId:   s.id,
          studentName: s.name,
          rollNumber:  s.roll_number ?? '—',
          status:      attMap.get(s.id) ?? 'present',
        })),
      );
    } catch { toast.error('Failed to load attendance data'); }
    finally   { setLoading(false); }
  }, [batchId, date]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  function cycleStatus(idx: number) {
    setGrid((prev) => {
      const next = [...prev];
      const cur  = statuses.indexOf(next[idx].status);
      next[idx]  = { ...next[idx], status: statuses[(cur + 1) % statuses.length] };
      return next;
    });
  }

  function markAll(status: Status) {
    setGrid((prev) => prev.map((r) => ({ ...r, status })));
  }

  async function submitAttendance() {
    if (!grid.length) return;
    setSubmitting(true);
    try {
      await api.post('/attendance/mark', {
        batchId:  parseInt(batchId),
        date,
        records:  grid.map((r) => ({ studentId: r.studentId, status: r.status })),
      });
      toast.success(`Attendance saved for ${grid.length} students`);
      fetchGrid();
    } catch { toast.error('Failed to save attendance'); }
    finally  { setSubmitting(false); }
  }

  async function generatePdf() {
    try {
      const res = await api.post<ApiResponse<{ url: string }>>('/attendance/reports/generate-pdf', {
        type:    'daily_slip',
        batchId: parseInt(batchId),
        date,
      });
      setPdfUrl(res.data.data.url);
      toast.success('PDF generated');
    } catch { toast.error('PDF generation failed'); }
  }

  async function sendWhatsapp() {
    if (!pdfUrl) { toast.error('Generate the PDF first'); return; }
    try {
      const res = await api.post<ApiResponse<{ sent: number; failed: number }>>('/attendance/reports/send-whatsapp', {
        batchId:     parseInt(batchId),
        documentUrl: pdfUrl,
        date,
        messageType: 'daily_slip',
      });
      toast.success(`Sent to ${res.data.data.sent} parents`);
    } catch { toast.error('WhatsApp send failed'); }
  }

  const present  = grid.filter((r) => r.status === 'present').length;
  const absent   = grid.filter((r) => r.status === 'absent').length;
  const late     = grid.filter((r) => r.status === 'late').length;
  const total    = grid.length;

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Mark and manage daily attendance</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-5 flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-end">
        <div>
          <label className="label">Batch</label>
          <select className="select w-52" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              className="input pl-9 w-44"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        {existing.length > 0 && (
          <span className="badge-yellow self-end mb-0.5">Already marked – editing</span>
        )}
      </div>

      {/* Bulk actions */}
      {grid.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-slate-500 dark:text-slate-400 self-center">Mark all as:</span>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => markAll(s)}
              className={clsx('px-3 py-1 rounded-lg text-xs font-medium border transition-colors', statusConfig[s].cls)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Attendance grid */}
      {loading ? <SectionLoader /> : grid.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          {batches.length === 0 ? 'No batches found. Create a batch first.' : 'No students in this batch.'}
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="flex gap-4 mb-4 text-sm">
            <span className="text-green-600 dark:text-green-400 font-medium">✓ Present: {present}</span>
            <span className="text-red-600   dark:text-red-400   font-medium">✗ Absent: {absent}</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">◷ Late: {late}</span>
            <span className="text-slate-500 dark:text-slate-400">Total: {total}</span>
          </div>

          {/* Student grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {grid.map((row, idx) => {
              const cfg = statusConfig[row.status];
              return (
                <button
                  key={row.studentId}
                  onClick={() => cycleStatus(idx)}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-100 hover:shadow-sm',
                    cfg.cls,
                  )}
                  title="Click to cycle status"
                  aria-label={`${row.studentName} – ${row.status}`}
                >
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border', cfg.cls)}>
                    {cfg.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.studentName}</p>
                    <p className="text-xs opacity-70">{row.rollNumber}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button onClick={submitAttendance} disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : <><CheckCircle2 className="w-4 h-4" /> Save Attendance</>}
            </button>
            <button onClick={generatePdf} className="btn-secondary">
              <FileDown className="w-4 h-4" /> Generate PDF Slip
            </button>
            {pdfUrl && (
              <>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  View PDF
                </a>
                <button onClick={sendWhatsapp} className="btn-secondary">
                  <Send className="w-4 h-4" /> Send to Parents
                </button>
              </>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
