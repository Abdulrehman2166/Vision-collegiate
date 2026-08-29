'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SectionLoader } from '@/components/ui/Loading';
import { CalendarDays, RotateCcw, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { type ApiResponse } from '@/utils/api';
import { getRealToday } from '@/utils/dates';

export default function SettingsPage() {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [workingDate, setWorkingDate] = useState('');
  const [realToday,  setRealToday]  = useState(getRealToday());

  useEffect(() => {
    api.get<ApiResponse<{ workingDate: string }>>('/settings')
      .then((r) => setWorkingDate(r.data.data.workingDate ?? getRealToday()))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!workingDate) return;
    setSaving(true);
    try {
      const res = await api.put<ApiResponse<{ workingDate: string }>>('/settings', { workingDate });
      setWorkingDate(res.data.data.workingDate);
      toast.success('Working date saved');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to save';
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function reset() {
    setSaving(true);
    try {
      const res = await api.put<ApiResponse<{ workingDate: string }>>('/settings', { workingDate: null });
      setWorkingDate(res.data.data.workingDate);
      setRealToday(getRealToday());
      toast.success('Reset to the real current date');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to reset';
      toast.error(msg);
    } finally { setSaving(false); }
  }

  const isOverridden = workingDate && workingDate !== format(new Date(), 'yyyy-MM-dd');

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">School-level preferences</p>
        </div>
      </div>

      {loading ? <SectionLoader /> : (
        <div className="max-w-lg space-y-5">

          <div className="card p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Working Date</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Set which date the school currently treats as &quot;today&quot;. Attendance,
                  Dashboard and Analytics will use this date instead of the real calendar date.
                </p>
              </div>
            </div>

            {isOverridden && (
              <div className="badge-yellow mb-4">A custom working date is active – the app is using {workingDate}.</div>
            )}
            {!isOverridden && (
              <div className="badge-green mb-4">Using the real current date ({workingDate}).</div>
            )}

            <label className="label">Working date</label>
            <div className="relative mb-4">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                className="input pl-9 w-56"
                value={workingDate}
                max={new Date(new Date().getTime() + 86400000 * 365).toISOString().split('T')[0]}
                onChange={(e) => setWorkingDate(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : <><CheckCircle2 className="w-4 h-4" /> Save Working Date</>}
              </button>
              <button onClick={reset} disabled={saving} className="btn-secondary">
                <RotateCcw className="w-4 h-4" /> Reset to Real Today
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Real current date: {realToday}. When set, the working date overrides it everywhere in the app.
            </p>
          </div>

        </div>
      )}
    </AppShell>
  );
}