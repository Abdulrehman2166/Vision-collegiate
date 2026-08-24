'use client';
import { useState } from 'react';
import { clsx } from 'clsx';
import { MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Column<T> {
  key:        string;
  header:     string;
  render?:    (row: T, idx: number) => React.ReactNode;
  className?: string;
  sortable?:  boolean;
}

interface RowAction<T> {
  label:    string;
  icon?:    React.ReactNode;
  onClick:  (row: T) => void;
  danger?:  boolean;
}

interface TableProps<T> {
  columns:       Column<T>[];
  data:          T[];
  keyField:      keyof T;
  loading?:      boolean;
  emptyMessage?: string;
  onRowClick?:   (row: T) => void;
  rowActions?:   RowAction<T>[];
  selectable?:   boolean;
  onSelect?:     (selected: T[]) => void;
}

// ─── Row menu ─────────────────────────────────────────────────────────────────
function RowMenu<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                   hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-44 py-1.5 rounded-xl overflow-hidden
                          bg-white dark:bg-[#181830]
                          border border-slate-200/60 dark:border-white/[0.08]
                          shadow-modal animate-scale-in">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={() => { a.onClick(row); setOpen(false); }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors',
                  a.danger
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                )}
              >
                {a.icon && <span className="flex-shrink-0">{a.icon}</span>}
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table<T extends object>({
  columns, data, keyField,
  loading = false, emptyMessage = 'No data found.',
  onRowClick, rowActions = [], selectable = false, onSelect,
}: TableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey,  setSortKey]  = useState<string | null>(null);
  const [sortDir,  setSortDir]  = useState<'asc'|'desc'>('asc');

  function toggleRow(key: string, row: T) {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
    onSelect?.(data.filter(r => next.has(String(r[keyField]))));
  }

  function toggleAll() {
    if (selected.size === data.length) {
      setSelected(new Set());
      onSelect?.([]);
    } else {
      const all = new Set(data.map(r => String(r[keyField])));
      setSelected(all);
      onSelect?.(data);
    }
  }

  function handleSort(col: Column<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col.key); setSortDir('asc'); }
  }

  // Client-side sort
  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = String((a as Record<string,unknown>)[sortKey] ?? '');
        const bv = String((b as Record<string,unknown>)[sortKey] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : data;

  const hasActions = rowActions.length > 0;

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-white/[0.07]">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200/70 dark:border-white/[0.07]">
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={data.length > 0 && selected.size === data.length}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/20
                             text-brand-600 focus:ring-brand-500/40 cursor-pointer"
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col)}
                className={clsx(
                  'px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap',
                  'text-slate-400 dark:text-slate-600',
                  col.sortable && 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none',
                  col.className,
                )}
              >
                <span className="flex items-center gap-1.5">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc'
                      ? <ChevronUp className="w-3 h-3 text-brand-400" />
                      : <ChevronDown className="w-3 h-3 text-brand-400" />
                  )}
                </span>
              </th>
            ))}
            {hasActions && <th className="px-4 py-3 w-12" />}
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-[#0f0f1e] divide-y divide-slate-100/70 dark:divide-white/[0.04]">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {(selectable ? columns.length + 2 : columns.length + (hasActions ? 1 : 0))
                  ? Array.from({ length: columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0) }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="skeleton h-3 rounded-full" style={{ width: `${60 + Math.random()*30}%` }} />
                      </td>
                    ))
                  : null}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)}
                  className="px-4 py-14 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04]
                                  flex items-center justify-center text-slate-300 dark:text-slate-700 text-xl">
                    ∅
                  </div>
                  <p className="text-sm text-slate-400 dark:text-slate-600 font-medium">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => {
              const key = String(row[keyField]);
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'transition-colors duration-100 group',
                    isSelected && 'bg-brand-50/60 dark:bg-brand-500/[0.06]',
                    onRowClick && !isSelected && 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02] cursor-pointer',
                    !onRowClick && !isSelected && 'hover:bg-slate-50/40 dark:hover:bg-white/[0.01]',
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key, row)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-white/20
                                   text-brand-600 focus:ring-brand-500/40 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className={clsx(
                      'px-4 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap',
                      col.className,
                    )}>
                      {col.render ? col.render(row, idx) : String((row as Record<string,unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-3 py-3.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <RowMenu row={row} actions={rowActions} />
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
interface PaginationProps { page: number; pages: number; total: number; onPage: (p: number) => void; }

export function Pagination({ page, pages, total, onPage }: PaginationProps) {
  if (pages <= 1) return null;
  const pageNums = Array.from({ length: Math.min(5, pages) }, (_, i) =>
    Math.max(1, Math.min(pages - 4, page - 2)) + i
  );
  return (
    <div className="flex items-center justify-between mt-4 text-xs">
      <span className="text-slate-400 dark:text-slate-600 font-medium">{total} results</span>
      <div className="flex gap-1">
        {[
          { label: '←', p: page - 1, disabled: page <= 1 },
          ...pageNums.map(p => ({ label: String(p), p, disabled: false })),
          { label: '→', p: page + 1, disabled: page >= pages },
        ].map(({ label, p, disabled }) => (
          <button
            key={label + p}
            onClick={() => !disabled && onPage(p)}
            disabled={disabled}
            className={clsx(
              'px-2.5 py-1.5 rounded-lg border font-semibold transition-all duration-150 min-w-[2rem]',
              String(p) === String(page) && label !== '←' && label !== '→'
                ? 'bg-brand-600 border-brand-600 text-white shadow-glow-sm'
                : 'border-slate-200 dark:border-white/[0.07] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
