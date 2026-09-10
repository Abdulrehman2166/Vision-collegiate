'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, LayoutGrid, Table2, Users } from 'lucide-react';
import api, { type ApiResponse, type Student, type Batch } from '@/utils/api';
import { hasRole } from '@/utils/auth';
import { PerformancePersona, type PerformanceStudent } from '@/components/students/PerformancePersona';
import { Spinner } from '@/components/ui/Loading';

const schema = z.object({
  name:          z.string().min(2, 'Name is required'),
  grade:         z.enum(['Juniors', 'IX', 'X', 'XI', 'XII']),
  stream:        z.string().optional(),
  batch_id:      z.string().optional(),
  roll_number:   z.string().optional(),
  parent_name:   z.string().optional(),
  parent_phone:  z.string().optional(),
  parent_email:  z.string().email('Invalid email').optional().or(z.literal('')),
  date_of_birth: z.string().optional(),
  address:       z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function StudentsPage() {
  const isAdmin = hasRole('admin');

  const [students, setStudents] = useState<Student[]>([]);
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);

  // Performance IQ (futuristic persona view)
  const [view,         setView]         = useState<'table' | 'persona'>('table');
  const [performance,  setPerformance]  = useState<PerformanceStudent[]>([]);
  const [perfLoading,  setPerfLoading]  = useState(false);

  // Filters
  const [search,  setSearch]   = useState('');
  const [fGrade,  setFGrade]   = useState('');
  const [fBatch,  setFBatch]   = useState('');

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status: 'active' });
      if (search)  params.set('search',  search);
      if (fGrade)  params.set('grade',   fGrade);
      if (fBatch)  params.set('batchId', fBatch);
      const res = await api.get<ApiResponse<Student[]>>(`/students?${params}`);
      setStudents(res.data.data);
      setTotal(res.data.meta?.total ?? 0);
      setPages(res.data.meta?.pages ?? 1);
    } catch { /* handled by interceptor */ }
    finally { setLoading(false); }
  }, [page, search, fGrade, fBatch]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches?active=true')
      .then((r) => setBatches(r.data.data))
      .catch(() => {});
  }, []);

  // Load the futuristic performance portrait set when persona view is first opened
  useEffect(() => {
    if (view !== 'persona' || performance.length > 0 || perfLoading) return;
    setPerfLoading(true);
    api.get<ApiResponse<PerformanceStudent[]>>('/students/performance')
      .then((r) => setPerformance(r.data.data))
      .catch(() => toast.error('Failed to load performance portraits'))
      .finally(() => setPerfLoading(false));
  }, [view, performance.length, perfLoading]);

  // Client-side filtering for the portrait gallery (server page is table-only)
  const selectedBatchName = batches.find((b) => String(b.id) === fBatch)?.name;
  const perfFiltered = performance.filter((p) => {
    const q = search.toLowerCase();
    const matchQ     = !q || p.name.toLowerCase().includes(q) || (p.rollNumber ?? '').toLowerCase().includes(q);
    const matchGrade = !fGrade || p.grade === fGrade;
    const matchBatch = !fBatch || p.batchName === selectedBatchName;
    return matchQ && matchGrade && matchBatch;
  }).sort((a, b) => a.rank - b.rank);

  function openCreate() {
    setEditStudent(null);
    reset({});
    setModalOpen(true);
  }

  function openEdit(s: Student) {
    setEditStudent(s);
    reset({
      name:         s.name,
      grade:        s.grade as FormData['grade'],
      stream:       s.stream ?? '',
      batch_id:     s.batch_id ? String(s.batch_id) : '',
      roll_number:  s.roll_number ?? '',
      parent_name:  s.parent_name ?? '',
      parent_phone: s.parent_phone ?? '',
      parent_email: s.parent_email ?? '',
    });
    setModalOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        batch_id: data.batch_id ? parseInt(data.batch_id) : null,
        stream:   data.stream   || null,
        parent_email: data.parent_email || null,
      };

      if (editStudent) {
        await api.put(`/students/${editStudent.id}`, payload);
        toast.success('Student updated');
      } else {
        await api.post('/students', payload);
        toast.success('Student created');
      }
      setModalOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(s: Student) {
    setDeleteTarget(s);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      toast.success('Student deleted');
      setDeleteTarget(null);
      fetchStudents();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns = [
    { key: 'roll_number', header: 'Roll No.',  render: (s: Student) => s.roll_number ?? '—' },
    { key: 'name',        header: 'Name' },
    { key: 'grade',       header: 'Grade' },
    { key: 'batch_name',  header: 'Batch',     render: (s: Student) => s.batch_name ?? '—' },
    { key: 'parent_phone',header: 'Parent Phone', render: (s: Student) => s.parent_phone ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (s: Student) => (
        <span className={s.status === 'active' ? 'badge-green' : 'badge-gray'}>{s.status}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: Student) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(s)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <Pencil className="w-4 h-4 text-slate-500" />
          </button>
          {isAdmin && (
            <button onClick={() => handleDelete(s)} className="p-1 rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} total students</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Futuristic view toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {([
              { key: 'table',   label: 'Grid',   icon: Table2 },
              { key: 'persona', label: 'Personas', icon: LayoutGrid },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={view === key
                  ? { background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff', boxShadow: '0 0 16px -4px rgba(56,189,248,0.7)' }
                  : { color: '#94a3b8' }}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary self-start sm:self-auto">
              <Plus className="w-4 h-4" /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-full sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name or roll no…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="select w-full sm:w-36" value={fGrade} onChange={(e) => { setFGrade(e.target.value); setPage(1); }}>
          <option value="">All grades</option>
          {['Juniors','IX','X','XI','XII'].map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="select w-full sm:w-44" value={fBatch} onChange={(e) => { setFBatch(e.target.value); setPage(1); }}>
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name} — Grade {b.grade}{b.stream ? ` (${b.stream})` : ''}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {view === 'table' ? (
          <Table columns={columns} data={students} keyField="id" loading={loading} emptyMessage="No students found." />
        ) : perfLoading ? (
          <div className="flex items-center justify-center gap-3 py-16">
            <Spinner /> <span className="text-sm text-slate-400">Calibrating performance portraits…</span>
          </div>
        ) : (
          <div className="p-4">
            {perfFiltered.length === 0
              ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <Users className="w-8 h-8" />
                  <span className="text-sm">No portraits matched the filters.</span>
                </div>
              : <PerformancePersona students={perfFiltered} />}
          </div>
        )}
      </div>
      {view === 'table' && <Pagination page={page} pages={pages} total={total} onPage={setPage} />}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
             title={editStudent ? 'Edit Student' : 'Add Student'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Grade *</label>
              <select className="select" {...register('grade')}>
                {['Juniors','IX','X','XI','XII'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stream</label>
              <input className="input" placeholder="Science / Commerce / Arts" {...register('stream')} />
            </div>
            <div>
              <label className="label">Batch</label>
              <select className="select" {...register('batch_id')}>
                <option value="">— Select batch —</option>
                {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name} — Grade {b.grade}{b.stream ? ` (${b.stream})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roll Number</label>
              <input className="input" {...register('roll_number')} />
            </div>
            <div>
              <label className="label">Parent Name</label>
              <input className="input" {...register('parent_name')} />
            </div>
            <div>
              <label className="label">Parent Phone</label>
              <input className="input" type="tel" {...register('parent_phone')} />
            </div>
            <div>
              <label className="label">Parent Email</label>
              <input className="input" type="email" {...register('parent_email')} />
              {errors.parent_email && <p className="mt-1 text-xs text-red-500">{errors.parent_email.message}</p>}
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input className="input" type="date" {...register('date_of_birth')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input resize-none" rows={2} {...register('address')} />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : editStudent ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
             title="Delete student">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Delete <span className="font-semibold">"{deleteTarget?.name}"</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary" disabled={deleting}>Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
