'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { SectionLoader, Spinner } from '@/components/ui/Loading';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Trash2, Send, Download, ChevronDown, ChevronUp, ClipboardList, BarChart3, FileSpreadsheet, X } from 'lucide-react';
import { format } from 'date-fns';
import api, { type ApiResponse, type Test, type Batch } from '@/utils/api';
import { hasRole } from '@/utils/auth';

const questionSchema = z.object({
  section:       z.string().optional(),
  question:      z.string().min(1, 'Question is required'),
  answer:        z.string().optional(),
  marks:         z.coerce.number().int().positive().default(1),
  question_type: z.enum(['mcq','short','long','subjective']).default('subjective'),
  order_index:   z.coerce.number().int().default(0),
});

const testSchema = z.object({
  title:         z.string().min(2, 'Title is required'),
  subject:       z.string().min(1, 'Subject is required'),
  grade:         z.enum(['Juniors','IX','X','XI','XII']),
  stream:        z.string().optional(),
  batch_id:      z.string().optional(),
  total_marks:   z.coerce.number().int().positive().default(100),
  duration_mins: z.coerce.number().int().positive().default(180),
  test_date:     z.string().optional(),
  board_pattern: z.string().optional(),
  questions:     z.array(questionSchema).min(1, 'Add at least one question'),
});
type FormData = z.infer<typeof testSchema>;

interface MarksStudent {
  studentId:   number;
  studentName: string;
  rollNumber:  string;
  marks:       number | null;
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

export default function TestsPage() {
  const canCreate = hasRole('admin', 'teacher');
  const [tests,    setTests]    = useState<Test[]>([]);
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [wizardOpen, setWizardOpen]   = useState(false);
  const [step,       setStep]         = useState(1);
  const [submitting, setSubmitting]   = useState(false);
  const [expandedQ,  setExpandedQ]    = useState<number | null>(null);

  // marks entry
  const [marksTest,    setMarksTest]    = useState<Test | null>(null);
  const [marksSheet,   setMarksSheet]   = useState<MarksSheet | null>(null);
  const [marksDraft,   setMarksDraft]   = useState<Record<number, string>>({});
  const [marksLoading, setMarksLoading] = useState(false);
  const [marksSaving,  setMarksSaving]  = useState(false);

  // analytics reports
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportBatch, setReportBatch] = useState('');
  const [analyticsStudent, setAnalyticsStudent] = useState('');
  const [studentOptions, setStudentOptions]     = useState<{ id: number; name: string; roll_number: string | null }[]>([]);
  const [analyticsTitle, setAnalyticsTitle]     = useState('Monthly Test Analytics');
  const [pdfUrl,       setPdfUrl]      = useState('');
  const [pdfContent,   setPdfContent]  = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [generatingKind, setGeneratingKind] = useState<'batch' | 'student' | null>(null);

  const {
    register, handleSubmit, control, watch, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      grade: 'Juniors', total_marks: 100, duration_mins: 180,
      questions: [{ question: '', marks: 1, question_type: 'subjective', order_index: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'questions' });

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Test[]>>(`/tests?page=${page}&limit=20`);
      setTests(res.data.data);
      setTotal(res.data.meta?.total ?? 0);
      setPages(res.data.meta?.pages ?? 1);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchTests(); }, [fetchTests]);
  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches?active=true')
      .then((r) => setBatches(r.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stId = reportBatch ? `batchId=${reportBatch}&` : '';
    api.get<ApiResponse<{ id: number; name: string; roll_number: string | null }[]>>(
      `/students?${stId}limit=200&status=active`,
    )
      .then((r) => {
        setStudentOptions(r.data.data);
        const prev = studentOptions.find((s) => String(s.id) === analyticsStudent);
        if (!prev || !r.data.data.some((s) => s.id === prev.id)) setAnalyticsStudent('');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBatch]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      await api.post('/tests/generate', {
        ...data,
        batch_id: data.batch_id ? parseInt(data.batch_id) : null,
        stream:   data.stream   || null,
      });
      toast.success('Test paper generated');
      setWizardOpen(false);
      reset();
      setStep(1);
      fetchTests();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function dispatchTest(test: Test) {
    try {
      const res = await api.post<ApiResponse<{ sent: number; failed: number }>>(
        `/tests/${test.id}/dispatch-whatsapp`,
      );
      toast.success(`Sent to ${res.data.data.sent} parents`);
    } catch { toast.error('Dispatch failed'); }
  }

  async function openMarks(test: Test) {
    setMarksTest(test);
    setMarksSheet(null);
    setMarksDraft({});
    setMarksLoading(true);
    try {
      const res = await api.get<ApiResponse<MarksSheet>>(`/tests/${test.id}/marks`);
      setMarksSheet(res.data.data);
      setMarksDraft(
        Object.fromEntries(
          res.data.data.students.map((s) => [s.studentId, s.marks == null ? '' : String(s.marks)]),
        ),
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to load marks';
      toast.error(msg);
      setMarksTest(null);
    } finally {
      setMarksLoading(false);
    }
  }

  async function saveMarks() {
    if (!marksSheet) return;
    setMarksSaving(true);
    try {
      const records = marksSheet.students
        .map((s) => {
          const v = marksDraft[s.studentId]?.trim();
          if (!v) return null;
          const num = parseFloat(v);
          if (isNaN(num)) return null;
          return { studentId: s.studentId, marks: num };
        })
        .filter(Boolean) as { studentId: number; marks: number }[];
      if (!records.length) {
        toast.error('Enter marks for at least one student');
        setMarksSaving(false);
        return;
      }
      const res = await api.post<ApiResponse<{ saved: number }>>(`/tests/${marksSheet.test.id}/marks`, { records });
      toast.success(`Saved marks for ${res.data.data.saved} students`);
      setMarksTest(null);
      fetchTests();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to save marks';
      toast.error(msg);
    } finally {
      setMarksSaving(false);
    }
  }

  function openPdfModal(title: string, url: string) {
    setAnalyticsTitle(title);
    if (url.startsWith('data:')) {
      setPdfUrl('');
      setPdfContent(atob(url.split(',')[1]));
    } else {
      setPdfUrl(url);
      setPdfContent('');
    }
    setShowPdfModal(true);
  }

  async function generateBatchAnalytics() {
    if (!reportMonth) { toast.error('Select a month'); return; }
    if (generatingKind) return;
    setGeneratingKind('batch');
    try {
      const res = await api.post<ApiResponse<{ url: string }>>('/tests/reports/monthly-analytics', {
        month: reportMonth,
        ...(reportBatch ? { batchId: parseInt(reportBatch) } : {}),
      });
      openPdfModal(`Monthly Analytics – ${reportMonth}`, res.data.data.url);
      toast.success('Batch analytics generated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to generate report';
      toast.error(msg);
    } finally { setGeneratingKind(null); }
  }

  async function generateStudentAnalytics() {
    if (!reportMonth)   { toast.error('Select a month'); return; }
    if (!analyticsStudent) { toast.error('Select a student'); return; }
    if (generatingKind) return;
    setGeneratingKind('student');
    try {
      const res = await api.post<ApiResponse<{ url: string }>>('/tests/reports/monthly-analytics', {
        month:     reportMonth,
        ...(reportBatch ? { batchId: parseInt(reportBatch) } : {}),
        studentId: parseInt(analyticsStudent),
      });
      const st = studentOptions.find((s) => String(s.id) === analyticsStudent);
      openPdfModal(`${st?.name ?? 'Student'} Analytics – ${reportMonth}`, res.data.data.url);
      toast.success('Student analytics generated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to generate report';
      toast.error(msg);
    } finally { setGeneratingKind(null); }
  }

  const columns = [
    { key: 'title',         header: 'Title' },
    { key: 'subject',       header: 'Subject' },
    { key: 'grade',         header: 'Grade',  render: (t: Test) => `${t.grade}${t.stream ? ' – '+t.stream : ''}` },
    { key: 'batch_name',    header: 'Batch',  render: (t: Test) => t.batch_name ?? '—' },
    { key: 'total_marks',   header: 'Marks' },
    { key: 'test_date',     header: 'Date',   render: (t: Test) => t.test_date ? format(new Date(t.test_date), 'dd MMM yyyy') : '—' },
    {
      key: 'actions',
      header: '',
      render: (t: Test) => (
        <div className="flex items-center gap-2">
          {t.student_pdf_url && (
            <a href={t.student_pdf_url} target="_blank" rel="noopener noreferrer"
               className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" title="Download student PDF">
              <Download className="w-4 h-4 text-slate-500" />
            </a>
          )}
          {canCreate && t.batch_id && (
            <button onClick={() => dispatchTest(t)}
                    className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20" title="Send to parents">
              <Send className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </button>
          )}
          {canCreate && (
            <button onClick={() => openMarks(t)}
                    className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20" title="Enter marks">
              <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const watchedQuestions = watch('questions');

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Test Papers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} total tests</p>
        </div>
        {canCreate && (
          <button onClick={() => { reset(); setStep(1); setWizardOpen(true); }} className="btn-primary self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Create Test
          </button>
        )}
      </div>

      {/* Reports */}
      <div className="card p-4 sm:p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">MONTHLY TEST ANALYTICS</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto hidden sm:inline">
            Enter marks per test, then generate the end-of-month student report.
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-semibold">Batch / Class Report</p>
                <p className="text-xs text-slate-500">All students: rank, weekly trend, best &amp; weak subjects</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Month</label>
                <input type="month" className="input w-full" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
              </div>
              <div>
                <label className="label">Batch</label>
                <select className="select w-full" value={reportBatch} onChange={(e) => setReportBatch(e.target.value)}>
                  <option value="">All Batches</option>
                  {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={generateBatchAnalytics} disabled={generatingKind !== null} className="btn-primary w-full">
              {generatingKind === 'batch' ? <><Spinner size="sm" light /> Generating…</> : <><BarChart3 className="w-4 h-4" /> Generate Batch Report</>}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-violet-300" />
              </div>
              <div>
                <p className="text-sm font-semibold">Student Report</p>
                <p className="text-xs text-slate-500">Per-student detail: tests, subjects &amp; weekly trend</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Month</label>
                <input type="month" className="input w-full" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
              </div>
              <div>
                <label className="label">Student</label>
                <select className="select w-full" value={analyticsStudent} onChange={(e) => setAnalyticsStudent(e.target.value)}>
                  <option value="">— Select —</option>
                  {studentOptions.map((s) => <option key={s.id} value={String(s.id)}>{s.name}{s.roll_number ? ` (${s.roll_number})` : ''}</option>)}
                </select>
              </div>
            </div>
            <button onClick={generateStudentAnalytics} disabled={generatingKind !== null} className="btn-primary w-full">
              {generatingKind === 'student' ? <><Spinner size="sm" light /> Generating…</> : <><ClipboardList className="w-4 h-4" /> Generate Student Report</>}
            </button>
          </div>
        </div>
      </div>

      {loading ? <SectionLoader /> : (
        <>
          <div className="card p-0 overflow-hidden">
            <Table columns={columns} data={tests} keyField="id" emptyMessage="No tests yet." />
          </div>
          <Pagination page={page} pages={pages} total={total} onPage={setPage} />
        </>
      )}

      {/* ── Test Creation Wizard ── */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title="Create Test Paper" size="xl">
        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step >= s ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {s}
              </div>
              <span className={`text-xs ${step >= s ? 'text-brand-700 dark:text-brand-300 font-medium' : 'text-slate-400'}`}>
                {s === 1 ? 'Test Details' : 'Questions'}
              </span>
              {s < 2 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ─ Step 1: Metadata ─ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Title *</label>
                  <input className="input" placeholder="e.g. Unit Test 1 – Physics" {...register('title')} />
                  {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
                </div>
                <div>
                  <label className="label">Subject *</label>
                  <input className="input" placeholder="Physics, Maths…" {...register('subject')} />
                  {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject.message}</p>}
                </div>
                <div>
                  <label className="label">Grade *</label>
                  <select className="select" {...register('grade')}>
                    {['Juniors','IX','X','XI','XII'].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Stream</label>
                  <input className="input" placeholder="Science / Commerce…" {...register('stream')} />
                </div>
                <div>
                  <label className="label">Batch</label>
                  <select className="select" {...register('batch_id')}>
                    <option value="">— All —</option>
                    {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Total Marks</label>
                  <input className="input" type="number" {...register('total_marks')} />
                </div>
                <div>
                  <label className="label">Duration (minutes)</label>
                  <input className="input" type="number" {...register('duration_mins')} />
                </div>
                <div>
                  <label className="label">Test Date</label>
                  <input className="input" type="date" {...register('test_date')} />
                </div>
                <div>
                  <label className="label">Board Pattern</label>
                  <input className="input" placeholder="CBSE, ICSE, State…" {...register('board_pattern')} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setStep(2)} className="btn-primary">
                  Next: Add Questions →
                </button>
              </div>
            </div>
          )}

          {/* ─ Step 2: Questions ─ */}
          {step === 2 && (
            <div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {fields.map((field, idx) => (
                  <div key={field.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                      className="w-full flex items-center justify-between px-4 py-3
                                 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium
                                 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span>Q{idx + 1}. {watchedQuestions?.[idx]?.question?.slice(0, 60) || 'New question'}</span>
                      <div className="flex items-center gap-2">
                        <span className="badge-blue">{watchedQuestions?.[idx]?.marks ?? 1} mark{(watchedQuestions?.[idx]?.marks ?? 1) > 1 ? 's' : ''}</span>
                        {expandedQ === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {expandedQ === idx && (
                      <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="label">Section</label>
                            <input className="input" placeholder="Section A" {...register(`questions.${idx}.section`)} />
                          </div>
                          <div>
                            <label className="label">Type</label>
                            <select className="select" {...register(`questions.${idx}.question_type`)}>
                              <option value="subjective">Subjective</option>
                              <option value="short">Short Answer</option>
                              <option value="long">Long Answer</option>
                              <option value="mcq">MCQ</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Marks</label>
                            <input className="input" type="number" min={1} {...register(`questions.${idx}.marks`)} />
                          </div>
                        </div>
                        <div>
                          <label className="label">Question *</label>
                          <textarea className="input resize-none" rows={2} {...register(`questions.${idx}.question`)} />
                          {errors.questions?.[idx]?.question && (
                            <p className="mt-1 text-xs text-red-500">{errors.questions[idx]?.question?.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">Answer (teacher only)</label>
                          <textarea className="input resize-none" rows={2} {...register(`questions.${idx}.answer`)} />
                        </div>
                        <div className="flex justify-end">
                          <button type="button" onClick={() => remove(idx)} className="btn-danger text-xs py-1">
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {errors.questions?.root && (
                <p className="mt-2 text-xs text-red-500">{errors.questions.root.message}</p>
              )}

              <button
                type="button"
                onClick={() => {
                  append({ question: '', marks: 1, question_type: 'subjective', order_index: fields.length });
                  setExpandedQ(fields.length);
                }}
                className="btn-secondary w-full mt-3"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>

              <div className="flex justify-between pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                  ← Back
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Generating PDFs…' : 'Generate Test Paper'}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Marks Entry Modal ── */}
      <Modal
        open={marksTest !== null}
        onClose={() => setMarksTest(null)}
        title={marksSheet ? `Enter Marks – ${marksSheet.test.title}` : 'Enter Marks'}
        size="lg"
        description={marksSheet
          ? `${marksSheet.test.subject} · Total: ${marksSheet.test.total_marks} marks · ${marksSheet.students.length} students`
          : 'Loading…'}
      >
        {marksLoading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : marksSheet ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {marksSheet.students.map((s) => (
                <div key={s.studentId} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.studentName}</p>
                    <p className="text-xs text-slate-500">{s.rollNumber || '—'}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={marksSheet.test.total_marks}
                    step="0.5"
                    placeholder="–"
                    className="input w-20 text-center"
                    value={marksDraft[s.studentId] ?? ''}
                    onChange={(e) => setMarksDraft((d) => ({ ...d, [s.studentId]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500">
                {marksSheet.students.filter((s) => marksDraft[s.studentId]?.trim()).length} of {marksSheet.students.length} marked
              </span>
              <div className="flex gap-2">
                <button onClick={() => setMarksTest(null)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={saveMarks} disabled={marksSaving} className="btn-primary text-sm">
                  {marksSaving ? <><Spinner size="sm" light /> Saving…</> : 'Save Marks'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">Failed to load.</div>
        )}
      </Modal>

      {/* ── PDF Preview Modal ── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">{analyticsTitle}</h3>
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
                  className="w-full h-full min-h-[500px] border-0 rounded-lg"
                />
              ) : (
                <iframe
                  srcDoc={pdfContent}
                  title="Analytics Report"
                  className="w-full h-full min-h-[500px] border-0 rounded-lg"
                />
              )}
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
