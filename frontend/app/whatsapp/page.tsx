'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Table, Pagination } from '@/components/ui/Table';
import { SectionLoader } from '@/components/ui/Loading';
import { format } from 'date-fns';
import api, { type ApiResponse } from '@/utils/api';
import { clsx } from 'clsx';

interface WaLog {
  id: number;
  recipient_phone: string;
  recipient_name: string | null;
  message_type: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message: string | null;
  created_at: string;
}

const statusStyle: Record<string, string> = {
  sent:      'badge-blue',
  delivered: 'badge-green',
  read:      'badge-green',
  failed:    'badge-red',
  pending:   'badge-gray',
};

export default function WhatsAppPage() {
  const [logs,    setLogs]    = useState<WaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [fStatus, setFStatus] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (fStatus) params.set('status', fStatus);
      const res = await api.get<ApiResponse<WaLog[]>>(`/whatsapp/logs?${params}`);
      setLogs(res.data.data);
      setTotal(res.data.meta?.total ?? 0);
      setPages(res.data.meta?.pages ?? 1);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, fStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns = [
    { key: 'id',              header: '#',         className: 'w-12 text-slate-400' },
    { key: 'recipient_phone', header: 'Phone' },
    { key: 'recipient_name',  header: 'Name',      render: (l: WaLog) => l.recipient_name ?? '—' },
    { key: 'message_type',    header: 'Type',      render: (l: WaLog) => (
        <span className="badge-blue capitalize">{l.message_type?.replace(/_/g,' ')}</span>
      )},
    { key: 'status',          header: 'Status',    render: (l: WaLog) => (
        <span className={clsx(statusStyle[l.status] ?? 'badge-gray', 'capitalize')}>{l.status}</span>
      )},
    { key: 'error_message',   header: 'Error',     render: (l: WaLog) => l.error_message
        ? <span className="text-red-500 text-xs truncate max-w-48 block" title={l.error_message}>{l.error_message}</span>
        : '—'
    },
    { key: 'created_at',      header: 'Time',      render: (l: WaLog) => format(new Date(l.created_at), 'dd MMM, HH:mm') },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} total messages</p>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 mb-5">
        <select className="select w-44" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['pending','sent','delivered','read','failed'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? <SectionLoader /> : (
        <>
          <div className="card p-0 overflow-hidden">
            <Table columns={columns} data={logs} keyField="id" emptyMessage="No WhatsApp logs found." />
          </div>
          <Pagination page={page} pages={pages} total={total} onPage={setPage} />
        </>
      )}
    </AppShell>
  );
}
