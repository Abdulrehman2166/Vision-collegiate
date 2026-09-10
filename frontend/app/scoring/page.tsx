'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Loading';
import { EnterMarksModal, type MarksTarget } from '@/components/ui/EnterMarksModal';
import { ClipboardList, Plus, CalendarRange, ChevronLeft, ChevronRight, BookOpen, Download, X, BarChart3, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import api, { type ApiResponse, type Test, type Batch } from '@/utils/api';
import { hasRole } from '@/utils/auth';
import { getWorkingDate } from '@/utils/dates';

interface ScheduleDay { day: string; subject: string; teacher: string | null }
interface ScheduleWeek { week: number; days: ScheduleDay[] }
interface ScheduleGrade { grade: string; weeks: ScheduleWeek[] }

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Week index (1-4) for a date within a month, matching analytics bucketing. */
function weekOfMonth(d: Date): number {
  return Math.min(Math.floor((d.getDate() - 1) / 7) + 1, 4);
}

/** First day of `week` in `year-month`, Monday-aligned so we can map schedule days. */
function mondayOf(year: number, month: number, week: number): Date {
  const first = new Date(year, month, (week - 1) * 7 + 1);
  const dow = (first.getDay() + 6) % 7; // Monday=0
  return new Date(year, month, first.getDate() - dow);
}

export default function ScoringPage() {
  const canCreate = hasRole('admin', 'teacher');
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [tests,    setTests]    = useState<Test[]>([]);
  const [schedule, setSchedule] = useState<ScheduleGrade[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);

  // selection
  const [batchId,  setBatchId]  = useState('');
  const [month,    setMonth]    = useState(format(new Date(), 'yyyy-MM'));
  const [week,     setWeek]     = useState(Math.min(Math.floor((new Date().getDate() - 1) / 7) + 1, 4));

  // custom test quick-add
  const [quickOpen, setQuickOpen]   = useState(false);
  const [quickSubj, setQuickSubj]   = useState('');
  const [quickDate, setQuickDate]   = useState('');
  const [quickTotal, setQuickTotal] = useState(50);
  const [creating, setCreating]     = useState(false);

  // marks modal
  const [marksTarget, setMarksTarget] = useState<MarksTarget | null>(null);

  // analytics PDF
  const [pdfTitle, setPdfTitle]         = useState('Monthly Analytics');
  const [pdfUrl,   setPdfUrl]           = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const selected = batches.find((b) => b.id === Number(batchId));
  const gradeSchedule = schedule.find((g) => g.grade === selected?.grade);
  const weekDays = gradeSchedule?.weeks.find((w) => w.week === week)?.days ?? [];

  // default month/week from the working date once loaded
  useEffect(() => {
    let alive = true;
    getWorkingDate().then((wd) => {
      if (!alive) return;
      const d = parseISO(wd);
      setMonth(format(d, 'yyyy-MM'));
      setWeek(weekOfMonth(d));
    });
    return () => { alive = false; };
  }, []);

  // load batches + schedule
  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches?active=true')
      .then((r) => {
        setBatches(r.data.data);
        if (r.data.data[0]) setBatchId(String(r.data.data[0].id));
      })
      .catch(() => toast.error('Failed to load batches'));
    api.get<ApiResponse<{ grades: ScheduleGrade[] }>>('/schedule')
      .then((r) => { if (Array.isArray(r.data.data?.grades)) setSchedule(r.data.data.grades); })
      .catch(() => {});
  }, []);

  // load tests for the selected batch
  const loadTests = useCallback(async () => {
    if (!batchId) return;
    setLoadingTests(true);
    try {
      const res = await api.get<ApiResponse<Test[]>>(`/tests?batchId=${batchId}&limit=100`);
      setTests(res.data.data);
    } catch { setTests([]); }
    finally { setLoadingTests(false); }
  }, [batchId]);

  useEffect(() => { loadTests(); }, [loadTests]);

  /** For a given day+subject slot, find an existing test on the computed date. */
  function findExisting(day: string, subject: string): Test | undefined {
    return tests.find((t) => {
      if (!t.test_date) return false;
      const d = parseISO(t.test_date);
      const scheduleMonday = mondayOf(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, week);
      const slotDate = new Date(scheduleMonday.getFullYear(), scheduleMonday.getMonth(), scheduleMonday.getDate() + Math.max(0, DAY_ORDER.indexOf(day)));
      return t.subject === subject && format(d, 'yyyy-MM-dd') === format(slotDate, 'yyyy-MM-dd');
    });
  }

  function openQuick(day?: string, subject?: string) {
    const scheduleMonday = mondayOf(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, week);
    const slotDate = day ? new Date(scheduleMonday.getFullYear(), scheduleMonday.getMonth(), scheduleMonday.getDate() + Math.max(0, DAY_ORDER.indexOf(day))) : new Date();
    setQuickSubj(subject ?? '');
    setQuickDate(format(slotDate, 'yyyy-MM-dd'));
    setQuickTotal(selected?.stream ? 20 : 50); // Juniors default smaller tests
    setQuickOpen(true);
  }

  async function quickCreate() {
    if (!batchId) { toast.error('Select a batch first'); return; }
    if (!quickSubj.trim()) { toast.error('Enter a subject'); return; }
    if (!quickDate) { toast.error('Pick a date'); return; }
    if (!quickTotal || quickTotal <= 0) { toast.error('Enter a valid total'); return; }
    setCreating(true);
    try {
      const b = batches.find((x) => x.id === Number(batchId));
      const title = `${b?.grade ?? ''} ${quickSubj.trim()} Test – ${format(parseISO(quickDate), 'dd MMM')}`;
      const res = await api.post<ApiResponse<Test>>('/tests/quick', {
        title,
        subject: quickSubj.trim(),
        grade: b?.grade ?? 'Juniors',
        stream: b?.stream ?? null,
        batch_id: Number(batchId),
        total_marks: quickTotal,
        duration_mins: 60,
        test_date: quickDate,
      });
      toast.success('Custom test created');
      setQuickOpen(false);
      loadTests();
      setMarksTarget({ id: res.data.data.id, title, subject: quickSubj.trim(), total_marks: quickTotal, test_date: quickDate });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to create test';
      toast.error(msg);
    } finally { setCreating(false); }
  }

  function shiftWeek(delta: number) {
    const next = Math.min(4, Math.max(1, week + delta));
    setWeek(next);
  }

  async function generatePdf() {
    if (!month) { toast.error('Select a month'); return; }
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const res = await api.post<ApiResponse<{ url: string }>>('/tests/reports/monthly-analytics', {
        month,
        ...(batchId ? { batchId: Number(batchId) } : {}),
      });
      const label = batchId ? `Monthly Analytics – ${selected?.name ?? `Batch #${batchId}`}` : `Monthly Analytics – All Batches`;
      setPdfTitle(`${label} · ${month}`);
      if (res.data.data.url.startsWith('data:')) {
        setPdfUrl('');
      } else {
        setPdfUrl(res.data.data.url);
      }
      setShowPdfModal(true);
      toast.success('Analytics PDF generated');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to generate report';
      toast.error(msg);
    } finally { setGeneratingPdf(false); }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Weekly Scoring</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter marks per scheduled subject · add custom tests · saved instantly
            </p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <button onClick={generatePdf} disabled={generatingPdf} className="btn-secondary self-start sm:self-auto">
                {generatingPdf ? <><Spinner size="sm" /> Generating…</> : <><BarChart3 className="w-4 h-4" /> PDF Report</>}
              </button>
              <button onClick={() => openQuick()} className="btn-primary self-start sm:self-auto">
                <Plus className="w-4 h-4" /> Custom Test
              </button>
            </div>
          )}
        </div>

        {/* Selectors */}
        <div className="card p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Batch / Class</label>
            <select className="select w-full sm:w-56" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">— Select batch —</option>
              {batches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name} — {b.grade}{b.stream ? ` (${b.stream})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Month</label>
            <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label className="label">Week</label>
            <div className="flex items-center gap-1">
              <button onClick={() => shiftWeek(-1)} className="btn-secondary py-1.5 px-2"><ChevronLeft className="w-4 h-4" /></button>
              <button className="input w-24 text-center not-italic" onClick={() => shiftWeek(0)}>
                Week {week}{week === 4 ? ' · Grand' : ''}
              </button>
              <button onClick={() => shiftWeek(1)} className="btn-secondary py-1.5 px-2"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Week board */}
        {!batchId ? (
          <div className="card p-10 text-center text-slate-500 text-sm">Select a batch to see its weekly subjects.</div>
        ) : !gradeSchedule || !weekDays.length ? (
          <div className="card p-10 text-center text-slate-500 text-sm">
            No schedule found for {selected?.grade}{selected?.stream ? ` (${selected.stream})` : ''} week {week}.
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            {/* Day column headers */}
            <div className="grid gap-3 min-w-fit" style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(180px, 1fr))` }}>
              {weekDays.map((slot) => (
                <DayColumn
                  key={`${slot.day}-${slot.subject}`}
                  slot={slot}
                  month={month}
                  week={week}
                  batchId={batchId}
                  canCreate={canCreate}
                  loading={loadingTests}
                  findExisting={(day, subject) => findExisting(day, subject)}
                  onEnterMarks={(t) => setMarksTarget({ id: t.id, title: t.title, subject: t.subject, total_marks: t.total_marks, test_date: t.test_date })}
                  onCustom={() => openQuick(slot.day, slot.subject)}
                  onTotalUpdated={loadTests}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick custom test modal */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Add Custom Test" description="Create a standalone test for this week, then enter marks.">
        <div className="space-y-4">
          <div>
            <label className="label">Subject *</label>
            <input
              list="scoring-subjects"
              className="input w-full"
              placeholder="e.g. Physics, Maths, Islamiat…"
              value={quickSubj}
              onChange={(e) => setQuickSubj(e.target.value)}
            />
            <datalist id="scoring-subjects">
              {['Physics','Chemistry','Biology','Mathematics','English','Urdu','Islamiat','Pak Studies','Computer Science','Computer','Accounting','Business','Economics','Statistics'].map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input w-full" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Total Marks *</label>
              <input type="number" min={1} className="input w-full" value={quickTotal} onChange={(e) => setQuickTotal(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
            Batch: <span className="font-semibold text-slate-700 dark:text-slate-300">{selected ? `${selected.name} (${selected.grade}${selected.stream ? ' – ' + selected.stream : ''})` : '—'}</span>
          </div>
          <div className="form-actions">
            <button onClick={() => setQuickOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={quickCreate} disabled={creating} className="btn-primary text-sm">
              {creating ? <><Spinner size="sm" light /> Creating…</> : <>Create & Enter Marks</>}
            </button>
          </div>
        </div>
      </Modal>

      <EnterMarksModal open={marksTarget !== null} test={marksTarget} onClose={() => setMarksTarget(null)} onSaved={loadTests} />

      {/* ── PDF Preview Modal ── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] max-h-dvh-90 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">{pdfTitle}</h3>
              <button onClick={() => setShowPdfModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {pdfUrl ? (
                <iframe
                  key={pdfUrl}
                  src={pdfUrl}
                  title="Analytics Report"
                  className="w-full min-h-[55vh] sm:min-h-[500px] border-0 rounded-lg"
                />
              ) : (
                <p className="py-10 text-center text-slate-500">Report preview unavailable — use the download option below.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                  <Download className="w-4 h-4 inline mr-1" /> Open / Download
                </a>
              )}
              <button onClick={() => setShowPdfModal(false)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Day column — one scheduled test slot per day
// ───────────────────────────────────────────────────────────────────────────────
function DayColumn({ slot, month, week, batchId, canCreate, loading, findExisting, onEnterMarks, onCustom, onTotalUpdated }: {
  slot: ScheduleDay;
  month: string;
  week: number;
  batchId: string;
  canCreate: boolean;
  loading: boolean;
  findExisting: (day: string, subject: string) => Test | undefined;
  onEnterMarks: (t: Test) => void;
  onCustom: () => void;
  onTotalUpdated: () => void;
}) {
  const existing = findExisting(slot.day, slot.subject);

  // inline out-of total editor for the slot's test
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalValue,   setTotalValue]   = useState('');
  const [savingTotal,  setSavingTotal]  = useState(false);

  async function saveTotal() {
    if (!existing) return;
    const v = parseInt(totalValue, 10);
    if (!v || v <= 0) { toast.error('Enter a valid out-of total'); return; }
    setSavingTotal(true);
    try {
      await api.patch(`/tests/${existing.id}`, { total_marks: v });
      toast.success(`Out of updated to ${v}`);
      setEditingTotal(false);
      onTotalUpdated();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to update';
      toast.error(msg);
    } finally {
      setSavingTotal(false);
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
            <CalendarRange className="w-4 h-4 text-sky-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{slot.day}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Week {week}</p>
          </div>
        </div>
        {canCreate && (
          <button onClick={onCustom} className="text-[11px] px-2 py-1 rounded-lg btn-secondary" title="Add custom test">
            <Plus className="w-3 h-3 inline mr-0.5" /> Test
          </button>
        )}
      </div>

      <div className={clsx('rounded-xl border p-3', existing ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/25 bg-amber-500/[0.05]')}>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className={clsx('w-4 h-4', existing ? 'text-emerald-400' : 'text-amber-400')} />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{slot.subject}</p>
        </div>
        {slot.teacher && <p className="text-[10px] text-slate-500 mb-1">{slot.teacher}</p>}

        {loading ? (
          <div className="py-3 flex justify-center"><Spinner size="sm" /></div>
        ) : existing ? (
          <div>
            <p className="text-[11px] text-slate-500 mb-1">{existing.title}</p>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Out of</span>
              {editingTotal ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="number"
                    min={1}
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTotal(); if (e.key === 'Escape') setEditingTotal(false); }}
                    className="input w-16 py-0.5 px-1.5 text-xs text-center font-bold"
                  />
                  <button onClick={saveTotal} disabled={savingTotal} className="btn-primary text-[10px] px-2 py-0.5">
                    {savingTotal ? '…' : 'OK'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-white tabular-nums">{existing.total_marks}</span>
                  {canCreate && (
                    <button
                      onClick={() => { setTotalValue(String(existing.total_marks)); setEditingTotal(true); }}
                      className="p-0.5 rounded text-slate-500 hover:text-sky-300"
                      title="Edit out-of marks"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => onEnterMarks(existing)} className="btn-primary text-xs w-full py-1.5">
              <ClipboardList className="w-3.5 h-3.5 inline mr-1" /> Enter Marks
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[11px] text-slate-500 mb-1.5">No test yet this week</p>
            <button onClick={onCustom} className="btn-secondary text-xs w-full py-1.5">
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Add test & enter marks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}