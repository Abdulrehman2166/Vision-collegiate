'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Loading';
import { Check, Search, Wand2, BookOpen, CalendarCheck, Target, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import { format } from 'date-fns';

const SUBJECT_SUGGESTIONS = [
  'Physics', 'Chemistry', 'Biology', 'Mathematics', 'English', 'Urdu',
  'Islamiat', 'Pak Studies', 'Computer Science', 'Computer', 'Accounting',
  'Business', 'Economics', 'Statistics',
];

interface MarksStudent {
  studentId:   number;
  studentName: string;
  rollNumber:  string;
  marks:       number | null;
  subject:     string;
  totalMarks:  number;
  updatedAt:   string | null;
}

interface MarksSheet {
  test: {
    id: number;
    title: string;
    subject: string;
    total_marks: number;
    test_date: string | null;
    batch_id: number | null;
    grade: string;
  };
  students: MarksStudent[];
}

export interface MarksTarget {
  id: number;
  title: string;
  subject: string;
  total_marks: number;
  test_date?: string | null;
}

interface Props {
  open: boolean;
  test: MarksTarget | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function EnterMarksModal({ open, test, onClose, onSaved }: Props) {
  const [sheet,     setSheet]     = useState<MarksSheet | null>(null);
  const [drafts,    setDrafts]    = useState<Record<number, string>>({});
  const [subjects,  setSubjects]  = useState<Record<number, string>>({});
  const [totals,    setTotals]    = useState<Record<number, string>>({});
  const [query,     setQuery]     = useState('');
  const [activeId,  setActiveId]  = useState<number | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkTotal,   setBulkTotal]   = useState('');
  const [testTotal,   setTestTotal]   = useState('');
  const [savingTotal, setSavingTotal] = useState(false);

  useEffect(() => {
    if (!open || !test) return;
    let cancelled = false;
    setLoading(true);
    setSheet(null);
    setDrafts({});
    setSubjects({});
    setTotals({});
    setQuery('');
    setBulkSubject('');
    setBulkTotal('');
    setTestTotal('');
    setActiveId(null);
    api.get<{ success: boolean; data: MarksSheet }>(`/tests/${test.id}/marks`)
      .then((r) => {
        if (cancelled) return;
        setSheet(r.data.data);
        setTestTotal(String(r.data.data.test.total_marks));
        setDrafts(Object.fromEntries(
          r.data.data.students.map((s) => [s.studentId, s.marks == null ? '' : String(s.marks)]),
        ));
        setSubjects(Object.fromEntries(r.data.data.students.map((s) => [s.studentId, s.subject])));
        setTotals(Object.fromEntries(r.data.data.students.map((s) => [s.studentId, String(s.totalMarks)])));
        const first = r.data.data.students.find((s) => s.marks == null) ?? r.data.data.students[0];
        if (first) setActiveId(first.studentId);
        requestAnimationFrame(() => {
          const el = document.getElementById(`marks-${first?.studentId ?? ''}`);
          if (el && first?.marks == null) el.focus();
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err.response?.data?.message ?? 'Failed to load marks';
        toast.error(msg);
        onClose();
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, test, onClose]);

  async function save(sid: number) {
    if (!sheet) return;
    const v = (drafts[sid] ?? '').trim();
    if (!v) { toast.error('Enter marks for this student'); return; }
    const num = parseFloat(v);
    const subject = (subjects[sid] ?? '').trim();
    if (!subject) { toast.error('Enter or select a subject'); return; }
    const totalStr = (totals[sid] ?? '').trim();
    const total = parseFloat(totalStr);
    if (!totalStr || isNaN(total) || total <= 0) { toast.error('Enter a valid out-of total'); return; }
    if (isNaN(num) || num < 0 || num > total) { toast.error(`Marks must be 0 – ${total}`); return; }
    setSaving(true);
    try {
      await api.post(`/tests/${sheet.test.id}/marks`, {
        records: [{ studentId: sid, marks: num, subject, totalMarks: total }],
      });
      const st = sheet.students.find((s) => s.studentId === sid);
      toast.success(`Saved ${st?.studentName ?? 'student'}'s marks`);
      const updated = sheet.students.map((s) =>
        s.studentId === sid ? { ...s, marks: num, subject, totalMarks: total } : s,
      );
      setSheet({ ...sheet, students: updated });
      setDrafts((d) => ({ ...d, [sid]: String(num) }));
      const next = updated.find((s) => s.marks == null);
      setActiveId(next ? next.studentId : null);
      requestAnimationFrame(() => {
        const el = document.getElementById(`marks-${next?.studentId ?? sid}`);
        el?.focus();
      });
      onSaved?.();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to save marks';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  /** Persist the test's own out-of total so it updates everywhere (row, card, analytics). */
  async function saveTestTotal() {
    if (!sheet) return;
    const v = parseFloat(testTotal);
    if (!testTotal.trim() || isNaN(v) || v <= 0) { toast.error('Enter a valid out-of total'); return; }
    setSavingTotal(true);
    try {
      await api.patch(`/tests/${sheet.test.id}`, { total_marks: v });
      setSheet((prev) => (prev ? { ...prev, test: { ...prev.test, total_marks: v } } : prev));
      toast.success(`Test out of updated to ${v}`);
      onSaved?.();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to update test total';
      toast.error(msg);
    } finally {
      setSavingTotal(false);
    }
  }

  function applyBulk() {
    if (!sheet) return;
    const unmarked = sheet.students.filter((s) => s.marks == null);
    if (!unmarked.length) { toast('All students already marked'); return; }
    setSubjects((d) => {
      const next = { ...d };
      if (bulkSubject.trim()) unmarked.forEach((s) => { next[s.studentId] = bulkSubject.trim(); });
      return next;
    });
    setTotals((d) => {
      const next = { ...d };
      if (bulkTotal.trim()) unmarked.forEach((s) => { next[s.studentId] = bulkTotal.trim(); });
      return next;
    });
    toast.success(`Applied to ${unmarked.length} unmarked student${unmarked.length > 1 ? 's' : ''}`);
  }

  const shown = (sheet?.students ?? []).filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.studentName.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q);
  });
  const markedCount = (sheet?.students ?? []).filter((s) => s.marks != null).length;
  const totalCount = sheet?.students.length ?? 0;
  const pct = totalCount ? Math.round((markedCount / totalCount) * 100) : 0;

  return (
    <Modal
      open={open && !!test}
      onClose={onClose}
      title={test ? `Enter Marks – ${test.title}` : 'Enter Marks'}
      size="lg"
      description={sheet && test
        ? `Grade ${sheet.test.grade} · ${test.subject} · up to ${test.total_marks} marks` +
          (test.test_date ? ` · ${format(new Date(test.test_date), 'dd MMM yyyy')}` : '')
        : (test
          ? `${test.subject} · up to ${test.total_marks} marks` +
            (test.test_date ? ` · ${format(new Date(test.test_date), 'dd MMM yyyy')}` : '')
          : 'Loading…')}
    >
      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : sheet ? (
        <div className="space-y-4">
          {/* progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-medium">
                <CalendarCheck className="inline w-3.5 h-3.5 mr-1 text-emerald-400" />
                {markedCount} of {totalCount} marked · {pct}%
              </span>
              <span className="text-slate-400">{totalCount - markedCount} remaining</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg,#10b981,#0ea5e9)',
                  boxShadow: '0 0 10px rgba(14,165,233,0.5)',
                }}
              />
            </div>
          </div>

          {/* test out-of total — teacher controls the marks value of this test */}
          <div className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
               style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(56,189,248,0.07))', border: '1px solid rgba(56,189,248,0.35)' }}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.25), rgba(56,189,248,0.18))' }}>
                <Target className="w-4 h-4 text-sky-300" style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.8))' }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white tracking-wide" style={{ letterSpacing: '0.06em' }}>TEST OUT OF</p>
                <p className="text-[10px] text-slate-500 truncate">Set the full marks of this test — applied everywhere</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step="1"
                className="input text-sm text-center w-24 font-bold"
                value={testTotal}
                placeholder={sheet.test.total_marks ? String(sheet.test.total_marks) : 'Total'}
                onChange={(e) => setTestTotal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTestTotal(); }}
              />
              <button onClick={saveTestTotal} disabled={savingTotal} className="btn-primary text-xs px-3 py-2 whitespace-nowrap">
                {savingTotal ? <><Spinner size="sm" light /> Saving…</> : <><Pencil className="w-3.5 h-3.5" /> Set Total</>}
              </button>
            </div>
          </div>

          {/* bulk apply toolbar */}
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/[0.06] p-3 flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <label className="label">Subject for all unmarked</label>
              <input
                list="marks-subjects"
                className="input text-sm"
                placeholder={test?.subject ?? 'Subject'}
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-28">
              <label className="label">Out of</label>
              <input
                type="number"
                min={1}
                step="1"
                className="input text-sm text-center"
                placeholder={test ? String(test.total_marks) : 'Total'}
                value={bulkTotal}
                onChange={(e) => setBulkTotal(e.target.value)}
              />
            </div>
            <button onClick={applyBulk} className="btn-primary text-xs px-3 py-2 whitespace-nowrap">
              <Wand2 className="w-3.5 h-3.5" /> Apply to all
            </button>
          </div>

          {/* search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Search student by name or roll no…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* inline list */}
          <datalist id="marks-subjects">
            {SUBJECT_SUGGESTIONS.map((sub) => <option key={sub} value={sub} />)}
          </datalist>
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700/70">
            {shown.map((s, i) => {
              const marked = s.marks != null;
              const active = s.studentId === activeId;
              return (
                <div key={s.studentId} className={clsx('px-3 py-2.5 grid gap-2', active ? 'bg-sky-500/[0.06]' : '')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {marked
                        ? <span className="w-5 h-5 rounded-full bg-emerald-500/90 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-white" /></span>
                        : <span className="w-5 h-5 rounded-full bg-white/[0.04] border border-slate-600 flex items-center justify-center flex-shrink-0 text-[10px] text-slate-500">#{i + 1}</span>}
                      <p className="text-sm font-semibold truncate">{s.studentName}</p>
                      {s.rollNumber && <span className="text-[11px] text-slate-500 flex-shrink-0">#{s.rollNumber}</span>}
                    </div>
                    {marked ? (
                      <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> {s.subject} · {s.marks}/{s.totalMarks}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-500/80">Not entered</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_96px_96px_auto] gap-2 items-end">
                    <div>
                      <input
                        list="marks-subjects"
                        className="input text-sm"
                        placeholder="Subject"
                        value={subjects[s.studentId] ?? ''}
                        onChange={(e) => setSubjects((d) => ({ ...d, [s.studentId]: e.target.value }))}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min={1}
                        step="1"
                        className="input text-sm text-center"
                        placeholder="Out of"
                        value={totals[s.studentId] ?? ''}
                        onChange={(e) => setTotals((d) => ({ ...d, [s.studentId]: e.target.value }))}
                      />
                    </div>
                    <div>
                      <input
                        id={`marks-${s.studentId}`}
                        type="number"
                        min={0}
                        step="0.5"
                        max={Number(totals[s.studentId]) || undefined}
                        className="input text-sm text-center font-semibold"
                        placeholder="Marks"
                        value={drafts[s.studentId] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.studentId]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(s.studentId); } }}
                        onFocus={() => setActiveId(s.studentId)}
                      />
                    </div>
                    <button
                      onClick={() => save(s.studentId)}
                      disabled={saving}
                      className="btn-primary text-xs px-3 py-2"
                    >
                      {saving && s.studentId === activeId ? <Spinner size="sm" light /> : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
            {!shown.length && (
              <p className="py-8 text-center text-sm text-slate-500">No students match "{query}".</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500">Enter marks, hit Enter or Save. Subject &amp; out-of may differ per student.</p>
            <button onClick={onClose} className="btn-secondary text-sm">Done</button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-500">Failed to load.</div>
      )}
    </Modal>
  );
}