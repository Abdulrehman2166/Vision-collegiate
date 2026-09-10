'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Loading';
import api, { type ApiResponse, type Batch } from '@/utils/api';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, AlertCircle, Plus, Trash2,
  CheckCircle2, Percent, PiggyBank, FolderOpen, CreditCard, RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';

interface Summary {
  month: string;
  expected: number;
  collected: number;
  cashIn: number;
  outstanding: number;
  overdue: number;
  expenses: number;
  profit: number;
  margin: number;
  records: number;
  studentsBilled: number;
  expenseCount: number;
  status: { paid: number; partial: number; unpaid: number };
}

interface TimelinePoint {
  month: string;
  expected: number;
  collected: number;
  expenses: number;
  net: number;
}

interface ExpenseRow {
  id: number;
  title: string;
  category: string;
  amount: number;
  date: string;
  notes: string | null;
  createdBy: string | null;
}

interface FeeStudent {
  studentId: number;
  name: string;
  rollNumber: string;
  batchName: string;
  grade: string;
  stream: string | null;
  expected: number;
  paid: number;
  remaining: number;
}

interface FeeRecord {
  id: number;
  studentId: number;
  amount: number;
  period: string;
  status: string;
  paidAmount: number;
  dueDate: string;
  paidDate: string | null;
  method: string | null;
  remarks: string | null;
}

const CATEGORIES = ['Rent', 'Salaries', 'Electricity', 'Stationery', 'Marketing', 'Maintenance', 'Transport', 'Utilities', 'Other'];

const DONUT_COLORS = ['#f59e0b', '#38bdf8', '#0ea5e9', '#06b6d4', '#10b981', '#f43f5e', '#22d3ee', '#22c55e', '#94a3b8', '#eab308'];

function money(n: number): string {
  const v = Math.round(n).toLocaleString('en-US');
  return `Rs ${v}`;
}

const STATUS_BADGE: Record<string, string> = { paid: 'badge-green', partial: 'badge-yellow', unpaid: 'badge-red' };

function currentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

export default function FinancePage() {
  const [month, setMonth]     = useState(currentMonth);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [expRow, setExpRow]   = useState<ExpenseRow[]>([]);
  const [byCategory, setByCategory] = useState<{ name: string; total: number }[]>([]);
  const [feeStudents, setFeeStudents] = useState<FeeStudent[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState<FeeStudent | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, tl, ex, f] = await Promise.all([
        api.get<ApiResponse<Summary>>(`/finance/summary?month=${month}`),
        api.get<ApiResponse<TimelinePoint[]>>('/finance/timeline?months=12'),
        api.get<ApiResponse<{ expenses: ExpenseRow[]; byCategory: { name: string; total: number }[]; categories: string[] }>>(`/finance/expenses?month=${month}`),
        api.get<ApiResponse<{ period: string; students: FeeStudent[]; records: FeeRecord[] }>>(`/finance/fees?period=${month}${batchId ? '&batchId=' + batchId : ''}`),
      ]);
      setSummary(sum.data.data);
      setTimeline(tl.data.data);
      setExpRow(ex.data.data.expenses);
      setByCategory(ex.data.data.byCategory);
      setFeeStudents(f.data.data.students);
      setFeeRecords(f.data.data.records);
    } catch {
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, [month, batchId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches')
      .then((r) => setBatches(r.data.data.filter((b) => b.is_active)))
      .catch(() => {});
  }, []);

  async function saveExpense(data: { title: string; category: string; amount: number; expenseDate: string; notes?: string }) {
    setSaving(true);
    try {
      await api.post('/finance/expenses', data);
      toast.success('Expense added');
      setExpenseOpen(false);
      load();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to add expense');
    } finally { setSaving(false); }
  }

  async function removeExpense(id: number) {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Expense deleted');
      load();
    } catch { toast.error('Failed to delete expense'); }
  }

  async function saveFee(f: FeeStudent, data: { amount: number; dueDate: string; status: string; paidAmount: number; method: string; remarks: string }) {
    setSaving(true);
    try {
      await api.post('/finance/fees', { studentId: f.studentId, period: month, amount: data.amount, dueDate: data.dueDate, status: data.status, paidAmount: data.paidAmount, method: data.method || undefined, remarks: data.remarks || undefined });
      toast.success(`Fee added for ${f.name}`);
      setFeeOpen(null);
      load();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to add fee');
    } finally { setSaving(false); }
  }

  async function markPaid(rec: FeeRecord) {
    try {
      await api.patch(`/finance/fees/${rec.id}`, { status: 'paid' });
      toast.success('Marked as paid');
      load();
    } catch { toast.error('Failed to update'); }
  }

  async function removeFee(id: number) {
    if (!confirm('Delete this fee record?')) return;
    try {
      await api.delete(`/finance/fees/${id}`);
      toast.success('Fee record deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  }

  const expByStudent = new Map<number, FeeRecord[]>();
  for (const r of feeRecords) {
    const list = expByStudent.get(r.studentId) ?? [];
    list.push(r);
    expByStudent.set(r.studentId, list);
  }

  const totalOutstanding = feeStudents.reduce((a, s) => a + s.remaining, 0);
  const chartData = [...timeline].reverse().slice(0, 12);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-400" /> Finance Command
            </h1>
            <p className="text-sm text-slate-400">Student fees, expenses and profit & loss — full control</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" className="input w-full sm:w-44" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} />
            <select className="select w-full sm:w-52" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All batches</option>
              {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.name} — {b.grade}{b.stream ? ` (${b.stream})` : ''}</option>)}
            </select>
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
        </div>

        {loading && !summary ? (
          <div className="card p-10 flex justify-center"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* KPI row */}
            {summary && (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {[
                  { label: 'Expected (Month)', value: money(summary.expected), color: '#38bdf8', icon: <FolderOpen className="w-4 h-4" /> },
                  { label: 'Collected', value: money(summary.collected), color: '#10b981', icon: <CheckCircle2 className="w-4 h-4" /> },
                  { label: 'Outstanding', value: money(totalOutstanding || summary.outstanding), color: '#f43f5e', icon: <AlertCircle className="w-4 h-4" /> },
                  { label: 'Expenses', value: money(summary.expenses), color: '#f59e0b', icon: <Receipt className="w-4 h-4" /> },
                  { label: 'Net Profit', value: money(summary.profit), color: summary.profit >= 0 ? '#34d399' : '#f87171', icon: summary.profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" /> },
                  { label: 'Margin', value: `${summary.margin}%`, color: '#38bdf8', icon: <Percent className="w-4 h-4" /> },
                ].map((k) => (
                  <div key={k.label} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</span>
                      <span className="icon-chip w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${k.color}1a`, border: `1px solid ${k.color}44`, color: k.color }}>{k.icon}</span>
                    </div>
                    <p className="text-lg font-black text-white tabular-nums" style={{ textShadow: `0 0 18px ${k.color}40` }}>{k.value}</p>
                    {k.label === 'Collected' && (
                      <p className="text-[10px] text-slate-500 mt-1">Cash in: {money(summary.cashIn)} · {summary.records} records</p>
                    )}
                    {k.label === 'Expected' && (
                      <p className="text-[10px] text-slate-500 mt-1">{summary.studentsBilled} students billed</p>
                    )}
                    {k.label === 'Outstanding' && (
                      <p className="text-[10px] text-slate-500 mt-1">{summary.status.paid} paid · {summary.status.partial} partial · {summary.status.unpaid} unpaid</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* P&L + Expense breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <TrendingUp className="w-4 h-4 text-emerald-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Profit & Loss</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Last 12 months</p>
                    </div>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} angle={-35} textAnchor="end" interval={1} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <RTooltip contentStyle={{ background: 'rgba(10,10,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelFormatter={(label) => `Period ${String(label)}`} formatter={(value, name) => [money(Number(value)), String(name)]} />
                      <Bar dataKey="collected" name="Collected (Fees)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="net" name="Net" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <PiggyBank className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Expenses · {month}</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">{summary?.expenseCount ?? 0} entries</p>
                    </div>
                  </div>
                  <button onClick={() => setExpenseOpen(true)} className="btn-primary text-xs py-1.5"><Plus className="w-3.5 h-3.5 inline mr-1" /> Add</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                          {byCategory.map((c, i) => <Cell key={c.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={{ background: 'rgba(10,10,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(value, name) => [money(Number(value)), String(name)]} />
                        <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {expRow.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">No expenses this month.</p>}
                    {expRow.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{e.title}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{e.category} · {e.date}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs font-bold text-amber-300 tabular-nums">{money(e.amount)}</span>
                          <button onClick={() => removeExpense(e.id)} className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fee manager */}
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="icon-chip w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}>
                    <CreditCard className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Fee Ledger · {month}</h2>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Per-student expected / paid / outstanding</p>
                  </div>
                </div>
                <div className="hud-chip">{feeStudents.length} students</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/[0.07]">
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Student</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Batch</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Expected</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Paid</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Remaining</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Records</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {feeStudents.map((s) => {
                      const recs = expByStudent.get(s.studentId) ?? [];
                      return (
                        <tr key={s.studentId}>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-slate-100">{s.name}{s.rollNumber && <span className="ml-1 text-[10px] text-slate-500">#{s.rollNumber}</span>}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{s.batchName}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-bold text-cyan-300 tabular-nums">{money(s.expected)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-300 tabular-nums">{money(s.paid)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums" style={{ color: s.remaining > 0 ? '#f87171' : '#475569' }}>{money(s.remaining)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1">
                              {recs.length === 0 && <span className="text-[10px] text-slate-600">not billed</span>}
                              {recs.map((r) => (
                                <div key={r.id} className="flex items-center gap-1.5">
                                  <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>{r.status}</span>
                                  <span className="text-[10px] text-slate-500 tabular-nums truncate max-w-36">{money(r.amount)}{r.remarks ? ` · ${r.remarks}` : ''}</span>
                                  {r.status !== 'paid' && (
                                    <button onClick={() => markPaid(r)} title="Mark paid" className="p-0.5 rounded text-slate-500 hover:text-emerald-400"><CheckCircle2 className="w-3 h-3" /></button>
                                  )}
                                  <button onClick={() => removeFee(r.id)} title="Delete" className="p-0.5 rounded text-slate-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button onClick={() => setFeeOpen(s)} className="text-xs btn-secondary py-1 px-2.5"><Plus className="w-3 h-3 inline mr-1" /> Fee</button>
                          </td>
                        </tr>
                      );
                    })}
                    {feeStudents.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500 text-sm">No active students found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Expense modal */}
      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Add Expense" description="Record an expense for the selected month." size="md">
        <ExpenseForm defaultDate={`${month}-01`} categories={CATEGORIES} saving={saving} onSave={saveExpense} onClose={() => setExpenseOpen(false)} />
      </Modal>

      {/* Add Fee modal */}
      <Modal open={feeOpen !== null} onClose={() => setFeeOpen(null)} title={`Add Fee — ${feeOpen?.name ?? ''}`} description={`Create a fee record for ${month}.`} size="md">
        {feeOpen && <FeeForm defaultPeriod={month} saving={saving} onSave={(d) => saveFee(feeOpen, d)} onClose={() => setFeeOpen(null)} />}
      </Modal>
    </AppShell>
  );
}

// ─── Expense form ──────────────────────────────────────────────────────────────
function ExpenseForm({ defaultDate, categories, saving, onSave, onClose }: {
  defaultDate: string; categories: string[]; saving: boolean;
  onSave: (d: { title: string; category: string; amount: number; expenseDate: string; notes?: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState('');

  function submit() {
    const amt = parseFloat(amount);
    if (!title.trim() || !Number.isFinite(amt) || amt <= 0) { toast.error('Enter a title and valid amount'); return; }
    onSave({ title: title.trim(), category, amount: amt, expenseDate: date, notes: notes.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <div><label className="label">Title *</label><input className="input w-full" placeholder="e.g. Electricity bill" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Category *</label>
          <select className="select w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="label">Amount (Rs) *</label><input type="number" min={0} className="input w-full" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      </div>
      <div><label className="label">Date</label><input type="date" className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className="label">Notes</label><textarea className="input w-full min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.07]">
        <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary text-sm">{saving ? <><Spinner size="sm" light /> Saving…</> : 'Save Expense'}</button>
      </div>
    </div>
  );
}

// ─── Fee form ──────────────────────────────────────────────────────────────────
function FeeForm({ defaultPeriod, saving, onSave, onClose }: {
  defaultPeriod: string; saving: boolean;
  onSave: (d: { amount: number; dueDate: string; status: string; paidAmount: number; method: string; remarks: string }) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(`${defaultPeriod}-10`);
  const [status, setStatus] = useState('unpaid');
  const [paidAmount, setPaidAmount] = useState('');
  const [method, setMethod] = useState('');
  const [remarks, setRemarks] = useState('');

  function submit() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    onSave({
      amount: amt,
      dueDate,
      status,
      paidAmount: status === 'paid' ? amt : parseFloat(paidAmount) || 0,
      method: method.trim(),
      remarks: remarks.trim(),
    });
  }

  return (
    <div className="space-y-4">
      <div><label className="label">Amount (Rs) *</label><input type="number" min={1} className="input w-full" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Due Date</label><input type="date" className="input w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div><label className="label">Status</label>
          <select className="select w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
      {status !== 'unpaid' && (
        <>
          <div><label className="label">{status === 'paid' ? 'Amount Paid (auto)' : 'Amount Paid'}</label>
            <input type="number" min={0} className="input w-full" value={status === 'paid' ? (parseFloat(amount) || 0) : paidAmount} readOnly={status === 'paid'} onChange={(e) => setPaidAmount(e.target.value)} />
          </div>
          <div><label className="label">Payment Method</label><input className="input w-full" placeholder="Cash / Bank / JazzCash…" value={method} onChange={(e) => setMethod(e.target.value)} /></div>
        </>
      )}
      <div><label className="label">Remarks</label><textarea className="input w-full min-h-[60px]" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.07]">
        <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary text-sm">{saving ? <><Spinner size="sm" light /> Saving…</> : 'Save Fee'}</button>
      </div>
    </div>
  );
}