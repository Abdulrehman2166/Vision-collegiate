import { clsx } from 'clsx';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns, data, keyField,
  loading = false, emptyMessage = 'No data found.',
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/[0.06]">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-3.5 text-xs font-bold uppercase tracking-wider',
                  'text-slate-500 dark:text-slate-500 whitespace-nowrap',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-[#0f0f1e] divide-y divide-slate-100/80 dark:divide-white/[0.04]">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex justify-center">
                  <div
                    className="w-7 h-7 rounded-full animate-spin"
                    style={{
                      background: 'conic-gradient(from 0deg, transparent 0deg, #6366f1 360deg)',
                      WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), black calc(100% - 2.5px))',
                      mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), black calc(100% - 2.5px))',
                    }}
                  />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.04]
                                  flex items-center justify-center text-slate-400 text-lg">
                    ○
                  </div>
                  <p className="text-sm text-slate-400 dark:text-slate-600">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'transition-colors duration-100',
                  onRowClick
                    ? 'cursor-pointer hover:bg-brand-50/50 dark:hover:bg-white/[0.02]'
                    : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.01]',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'px-4 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap',
                      col.className,
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, pages, total, onPage }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-slate-400 dark:text-slate-600 text-xs">{total} results</span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.06]
                     text-slate-500 dark:text-slate-400
                     hover:bg-slate-50 dark:hover:bg-white/[0.04]
                     disabled:opacity-30 transition-all duration-150 text-xs font-medium"
        >
          ←
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = Math.max(1, Math.min(pages - 4, page - 2)) + i;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150',
                p === page
                  ? 'border-brand-500 bg-brand-600 text-white shadow-glow-sm'
                  : 'border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.06]
                     text-slate-500 dark:text-slate-400
                     hover:bg-slate-50 dark:hover:bg-white/[0.04]
                     disabled:opacity-30 transition-all duration-150 text-xs font-medium"
        >
          →
        </button>
      </div>
    </div>
  );
}
