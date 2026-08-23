'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { SectionLoader } from '@/components/ui/Loading';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Users, GraduationCap } from 'lucide-react';
import api, { type ApiResponse, type Batch } from '@/utils/api';
import { hasRole } from '@/utils/auth';

const schema = z.object({
  grade:    z.enum(['IX', 'X', 'XI', 'XII']),
  stream:   z.string().optional(),
  name:     z.string().min(1, 'Name is required'),
  is_active: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function BatchesPage() {
  const isAdmin = hasRole('admin');
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editBatch,   setEditBatch]   = useState<Batch | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Batch[]>>('/batches?active=false');
      setBatches(res.data.data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  function openCreate() {
    setEditBatch(null);
    reset({ grade: 'IX', stream: '', name: '', is_active: true });
    setModalOpen(true);
  }

  function openEdit(b: Batch) {
    setEditBatch(b);
    reset({ grade: b.grade as FormData['grade'], stream: b.stream ?? '', name: b.name, is_active: b.is_active });
    setModalOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      if (editBatch) {
        await api.put(`/batches/${editBatch.id}`, data);
        toast.success('Batch updated');
      } else {
        await api.post('/batches', data);
        toast.success('Batch created');
      }
      setModalOpen(false);
      fetchBatches();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Error';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(b: Batch) {
    if (!confirm(`Delete batch "${b.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/batches/${b.id}`);
      toast.success('Batch deleted');
      fetchBatches();
    } catch { toast.error('Delete failed'); }
  }

  // Group by grade
  const gradeGroups = ['IX','X','XI','XII'].map((g) => ({
    grade: g,
    batches: batches.filter((b) => b.grade === g),
  })).filter((g) => g.batches.length > 0);

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Batches</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{batches.length} total batches</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Add Batch
          </button>
        )}
      </div>

      {loading ? <SectionLoader /> : batches.length === 0 ? (
        <div className="text-center py-20 text-slate-400">No batches found. Create one to get started.</div>
      ) : (
        <div className="space-y-8">
          {gradeGroups.map(({ grade, batches: gb }) => (
            <div key={grade}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Grade {grade}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gb.map((b) => (
                  <Card key={b.id} className="relative group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20">
                        <GraduationCap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                            <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{b.name}</h3>
                    {b.stream && <p className="text-sm text-slate-500 dark:text-slate-400">{b.stream}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {b.student_count} students
                      </span>
                      {!b.is_active && <span className="badge-gray">Inactive</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
             title={editBatch ? 'Edit Batch' : 'Add Batch'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Grade *</label>
            <select className="select" {...register('grade')}>
              {['IX','X','XI','XII'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <input className="input" placeholder="Science, Commerce, Arts…" {...register('stream')} />
          </div>
          <div>
            <label className="label">Batch Name *</label>
            <input className="input" placeholder="e.g. Batch A" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" {...register('is_active')} className="rounded" defaultChecked />
            <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">Active batch</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : editBatch ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
