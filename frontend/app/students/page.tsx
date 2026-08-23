'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import api, { type ApiResponse, type Student, type Batch } from '@/utils/api';
import { hasRole } from '@/utils/auth';

const schema = z.object({
  name:          z.string().min(2, 'Name is required'),
  grade:         z.enum(['IX', 'X', 'XI', 'XII']),
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

  // Filters
  const [search,  setSearch]   = useState('');
  const [fGrade,  setFGrade]   = useState('');
  const [fBatch,  setFBatch]   = useState('');

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
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
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/students/${s.id}`);
      toast.success('Student deleted');
      fetchStudents();
    } catch { toast.error('Delete failed'); }
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
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name or roll no…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="select w-36" value={fGrade} onChange={(e) => { setFGrade(e.target.value); setPage(1); }}>
          <option value="">All grades</option>
          {['IX','X','XI','XII'].map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="select w-44" value={fBatch} onChange={(e) => { setFBatch(e.target.value); setPage(1); }}>
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <Table columns={columns} data={students} keyField="id" loading={loading} emptyMessage="No students found." />
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

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
                {['IX','X','XI','XII'].map((g) => <option key={g} value={g}>{g}</option>)}
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
                {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
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

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : editStudent ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
