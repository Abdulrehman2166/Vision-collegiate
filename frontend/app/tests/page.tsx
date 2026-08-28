'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { SectionLoader } from '@/components/ui/Loading';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Trash2, Send, Download, ChevronDown, ChevronUp } from 'lucide-react';
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
    </AppShell>
  );
}
