'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { Table, Pagination } from '@/components/ui/Table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Eye, EyeOff } from 'lucide-react';
import api, { type ApiResponse, type User } from '@/utils/api';

const schema = z.object({
  name:     z.string().min(2, 'Name required'),
  email:    z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  role:     z.enum(['admin', 'teacher', 'parent', 'student']),
  phone:    z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const ROLE_COLORS: Record<string, string> = {
  admin:   'badge-blue',
  teacher: 'badge-green',
  parent:  'badge-yellow',
  student: 'badge-gray',
};

export default function UsersPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'teacher' },
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<User[]>>(`/auth/users?page=${page}&limit=20`);
      setUsers(res.data.data);
      setTotal(res.data.meta?.total ?? 0);
      setPages(res.data.meta?.pages ?? 1);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      await api.post('/auth/register', data);
      toast.success(`Account created for ${data.name}`);
      setOpen(false);
      reset();
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed';
      toast.error(msg);
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'name',  header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'role', header: 'Role',
      render: (u: User) => (
        <span className={ROLE_COLORS[u.role] ?? 'badge-gray'}>{u.role}</span>
      ),
    },
    { key: 'phone', header: 'Phone', render: (u: User) => u.phone ?? '—' },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Users</h1>
          <p className="text-sm text-slate-500">{total} total accounts</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} className="btn-primary self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <Table columns={columns} data={users} keyField="id" loading={loading} emptyMessage="No users found." />
      </div>
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title="Create User Account">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" placeholder="e.g. Rahul Sharma" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="user@example.com" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="select" {...register('role')}>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="parent">Parent</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" placeholder="+91 9876543210" {...register('phone')} />
          </div>
          <div>
            <label className="label">Password * (min 8 chars)</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
