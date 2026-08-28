'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SectionLoader } from '@/components/ui/Loading';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Clock, Send, FileDown, CalendarDays, X, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import api, { type ApiResponse, type Batch, type AttendanceRecord, type Student } from '@/utils/api';

type Status = 'present' | 'absent' | 'late' | 'holiday';

interface GridRow {
  studentId:   number;
  studentName: string;
  rollNumber:  string;
  status:      Status;
  parentPhone: string | null;
  parentName:  string | null;
  batchName?:  string | null;
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
  const [pdfContent,   setPdfContent] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches?active=true')
      .then((r) => {
        setBatches(r.data.data);
        if (r.data.data.length) setBatchId(String(r.data.data[0].id));
      })
      .catch(() => {});
  }, []);

  const fetchGrid = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setPdfContent('');
    try {
      const isAll = !batchId || batchId === 'all';
      const studRes = await api.get<ApiResponse<Student[]>>(
        isAll ? `/students?limit=200&status=active` : `/students?batchId=${batchId}&limit=200&status=active`,
      );
      const attRes = await api.get<ApiResponse<AttendanceRecord[]>>(
        isAll ? `/attendance/all?date=${date}` : `/attendance/batch/${batchId}?date=${date}`,
      );
      setExisting(attRes.data.data);

      const attMap = new Map(attRes.data.data.map((a) => [a.student_id, a.status as Status]));

      setGrid(
        studRes.data.data.map((s) => ({
          studentId:   s.id,
          studentName: s.name,
          rollNumber:  s.roll_number ?? '—',
          status:      attMap.get(s.id) ?? 'present',
          parentPhone: s.parent_phone ?? null,
          parentName:  s.parent_name ?? null,
          batchName:   s.batch_name,
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
      const isAll = !batchId || batchId === 'all';
      const res = await api.post<ApiResponse<{ count: number; skipped?: number }>>('/attendance/mark', {
        ...(isAll ? {} : { batchId: parseInt(batchId) }),
        date,
        records:  grid.map((r) => ({ studentId: r.studentId, status: r.status })),
      });
      const skipped = res.data.data?.skipped ?? 0;
      toast.success(
        skipped > 0
          ? `Saved for ${res.data.data?.count} students (${skipped} skipped – no batch)`
          : `Attendance saved for ${grid.length} students`,
      );
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
      const url = res.data.data.url;
      if (url.startsWith('data:')) {
        const html = atob(url.split(',')[1]);
        setPdfContent(html);
      } else {
        setPdfContent(`<iframe src="${url}" style="width:100%;height:100%;border:none;" />`);
      }
      toast.success('PDF generated');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message ?? 'PDF generation failed');
    }
  }

  function sendWhatsappToParents() {
    const parentsWithPhone = grid.filter((r) => r.parentPhone && r.parentPhone.trim());
    if (!parentsWithPhone.length) {
      toast.error('No parent phone numbers found for students in this batch');
      return;
    }
    const batchName = batches.find((b) => String(b.id) === batchId)?.name ?? '';
    const message = `Dear Parent, this is the attendance update for your child on ${date}. Batch: ${batchName}. Please contact the school for more details. - Vision Collegiate`;
    const encoded = encodeURIComponent(message);

    let opened = 0;
    for (const row of parentsWithPhone) {
      const phone = row.parentPhone!.replace(/[^0-9]/g, '');
      if (phone.length < 7) {
        toast.error(`Invalid phone number for ${row.studentName}'s parent: ${row.parentPhone}`);
        continue;
      }
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
      opened++;
    }
    toast.success(`Opening WhatsApp for ${opened} parents`);
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
            <option value="">All Students</option>
            {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name} — Grade {b.grade}</option>)}
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
          {batches.length === 0 ? 'No batches found. Create a batch first.' : 'No active students found.'}
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
                    <p className="text-xs opacity-70">
                      {(!batchId || batchId === 'all') && row.batchName ? `${row.batchName} · ` : ''}{row.rollNumber}
                    </p>
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
            {pdfContent && (
              <button onClick={() => setShowPdfModal(true)} className="btn-secondary">
                <FileDown className="w-4 h-4" /> View Slip
              </button>
            )}
            <button onClick={sendWhatsappToParents} className="btn-secondary">
              <MessageCircle className="w-4 h-4" /> Share on WhatsApp
            </button>
          </div>
        </>
      )}

      {/* PDF Preview Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Slip – {date}</h3>
              <button onClick={() => setShowPdfModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <iframe
                srcDoc={pdfContent}
                title="Attendance Slip"
                className="w-full h-full min-h-[500px] border-0 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowPdfModal(false)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
