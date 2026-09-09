/**
 * financeController – fees, expenses and monthly Profit & Loss.
 * Admin only. All money amounts are NUMERIC(12,2); returned as numbers.
 */
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';

export const EXPENSE_CATEGORIES = [
  'Rent', 'Salaries', 'Electricity', 'Stationery', 'Marketing',
  'Maintenance', 'Transport', 'Utilities', 'Other',
];

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

/** Pakistan-today as YYYY-MM-DD (all finance dates are PKT). */
function todayPKT(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  let y = '', m = '', d = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
  }
  return `${y}-${m}-${d}`;
}

function toNum(v: unknown): number {
  return Number(v) || 0;
}

function monthStart(month: string): string { return `${month}-01`; }
function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate(); // day 0 of next month = last day
  return `${month}-${String(last).padStart(2, '0')}`;
}

/** GET /api/v1/finance/summary?month=YYYY-MM */
export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const month = (req.query.month as string) ;
    const m = MONTH_RE.test(month) ? month : todayPKT().slice(0, 7);

    const [fees, exp, students, cash] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(amount)::float, 0)        AS expected,
           COALESCE(SUM(CASE WHEN status IN ('paid','partial') THEN paid_amount END)::float,0) AS collected,
           COALESCE(SUM(CASE WHEN status IN ('unpaid','partial') THEN amount - paid_amount END)::float,0) AS overdue,
           COUNT(*)::int                          AS records,
           COUNT(*) FILTER (WHERE status = 'paid')::int    AS paidCount,
           COUNT(*) FILTER (WHERE status = 'partial')::int AS partialCount,
           COUNT(*) FILTER (WHERE status = 'unpaid')::int  AS unpaidCount
         FROM fee_records WHERE period = $1`,
        [m],
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount)::float,0) AS total, COUNT(*)::int AS count
         FROM expenses WHERE expense_date BETWEEN $1::date AND $2::date`,
        [monthStart(m), monthEnd(m)],
      ),
      pool.query(
        `SELECT COUNT(DISTINCT student_id)::int AS count
         FROM fee_records WHERE period = $1`,
        [m],
      ),
      pool.query(
        `SELECT COALESCE(SUM(paid_amount)::float,0) AS cashIn
         FROM fee_records WHERE to_char(paid_date, 'YYYY-MM') = $1`,
        [m],
      ),
    ]);

    const expected  = toNum(fees.rows[0].expected);
    const collected = toNum(fees.rows[0].collected);
    const outstandingAll = toNum(
      (await pool.query(
        `SELECT COALESCE(SUM(amount - paid_amount)::float,0) AS o
         FROM fee_records WHERE status IN ('unpaid','partial')`,
      )).rows[0].o,
    );
    const expenses = toNum(exp.rows[0].total);
    const profit   = collected - expenses;
    const margin   = collected > 0 ? Math.round((profit / collected) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        month: m,
        expected,
        collected,
        cashIn:  toNum(cash.rows[0].cashIn),
        outstanding: outstandingAll,
        overdue: toNum(fees.rows[0].overdue),
        expenses,
        profit,
        margin,
        records:      toNum(fees.rows[0].records),
        studentsBilled: toNum(students.rows[0].count),
        expenseCount: toNum(exp.rows[0].count),
        status: {
          paid:    toNum(fees.rows[0].paidCount),
          partial: toNum(fees.rows[0].partialCount),
          unpaid:  toNum(fees.rows[0].unpaidCount),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/finance/timeline?months=12 */
export async function getTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const months = Math.min(24, Math.max(3, parseInt(req.query.months as string) || 12));
    const labels: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const [feeRows, expRows] = await Promise.all([
      pool.query(
        `SELECT period,
                SUM(amount)::float AS expected,
                SUM(CASE WHEN status IN ('paid','partial') THEN paid_amount END)::float AS collected
         FROM fee_records WHERE period = ANY($1::text[])
         GROUP BY period`,
        [labels],
      ),
      pool.query(
        `SELECT to_char(expense_date, 'YYYY-MM') AS month, SUM(amount)::float AS total
         FROM expenses GROUP BY 1`,
      ),
    ]);

    const feeMap   = new Map(feeRows.rows.map((r) => [r.period, r]));
    const expMap   = new Map(expRows.rows.map((r) => [r.month, r]));

    res.json({
      success: true,
      data: labels.map((month) => {
        const f = feeMap.get(month);
        const e = toNum(expMap.get(month)?.total);
        const collected = toNum(f?.collected);
        return {
          month,
          expected: toNum(f?.expected),
          collected,
          expenses: e,
          net: collected - e,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/finance/expenses?month=YYYY-MM */
export async function getExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const month = (req.query.month as string);
    const m = MONTH_RE.test(month) ? month : todayPKT().slice(0, 7);

    const rows = (await pool.query(
      `SELECT e.id, e.title, e.category, e.amount::float AS amount, e.notes,
              to_char(e.expense_date, 'YYYY-MM-DD') AS date, u.name AS "createdBy"
       FROM expenses e LEFT JOIN users u ON u.id = e.created_by
       WHERE to_char(e.expense_date, 'YYYY-MM') = $1
       ORDER BY e.expense_date DESC, e.id DESC`,
      [m],
    )).rows;

    const byCategory = new Map<string, number>();
    for (const r of rows) byCategory.set(r.category, toNum(byCategory.get(r.category)) + toNum(r.amount));

    res.json({ success: true, data: { expenses: rows, byCategory: [...byCategory.entries()].map(([name, total]) => ({ name, total })), categories: EXPENSE_CATEGORIES } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/finance/expenses */
export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, category, amount, expenseDate, notes } = req.body ?? {};
    if (!title || !category) throw createError('Title and category are required', 400);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) throw createError('Invalid amount', 400);
    const date = expenseDate && DATE_RE.test(expenseDate) ? expenseDate : todayPKT();

    const r = await pool.query(
      `INSERT INTO expenses (title, category, amount, expense_date, notes, created_by)
       VALUES ($1, $2, $3, $4::date, $5, $6)
       RETURNING id, title, category, amount::float AS amount`,
      [title, category, amt, date, notes ?? null, req.user!.id],
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/finance/expenses/:id */
export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) throw createError('Invalid expense id', 400);
    const r = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
    if (!r.rows.length) throw createError('Expense not found', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/finance/fees?period=YYYY-MM&batchId= */
export async function getStudentFees(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string);
    const p = MONTH_RE.test(period) ? period : todayPKT().slice(0, 7);
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string, 10) : undefined;

    const batchFilter = batchId ? 'AND s.batch_id = $2' : '';
    const params: (string | number)[] = [p];
    if (batchId) params.push(batchId);

    const students = (await pool.query(
      `SELECT
         s.id AS "studentId", s.name, COALESCE(s.roll_number,'') AS "rollNumber",
         b.name AS "batchName", b.grade, b.stream,
         COALESCE(SUM(f.amount) FILTER (WHERE f.period = $1), 0)::float AS expected,
         COALESCE(SUM(f.paid_amount) FILTER (WHERE f.period = $1), 0)::float AS paid,
         COALESCE(SUM(f.amount - f.paid_amount) FILTER (WHERE f.period = $1), 0)::float AS remaining
       FROM students s
       JOIN batches b ON b.id = s.batch_id
       LEFT JOIN fee_records f ON f.student_id = s.id AND f.period = $1
       WHERE s.status = 'active' ${batchFilter}
       GROUP BY s.id, s.name, s.roll_number, b.name, b.grade, b.stream
       ORDER BY b.grade, s.roll_number, s.name`,
      params,
    )).rows;

    const records = (await pool.query(
      `SELECT f.id, f.student_id AS "studentId", f.amount::float AS amount, f.period, f.status,
              f.paid_amount::float AS "paidAmount", to_char(f.due_date,'YYYY-MM-DD') AS "dueDate",
              to_char(f.paid_date,'YYYY-MM-DD') AS "paidDate", f.method, f.remarks,
              to_char(f.created_at,'YYYY-MM-DD HH24:MI') AS "createdAt"
       FROM fee_records f
       WHERE f.period = $1
       ORDER BY f.student_id, f.due_date`,
      [p],
    )).rows;

    res.json({ success: true, data: { period: p, students, records } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/finance/fees */
export async function createFeeRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId, period, amount, dueDate, status, paidAmount, method, remarks } = req.body ?? {};
    if (!studentId || !period || !amount) throw createError('Student, period and amount are required', 400);
    if (!MONTH_RE.test(String(period))) throw createError('Period must be YYYY-MM', 400);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw createError('Invalid amount', 400);

    const st = ['paid', 'partial', 'unpaid'].includes(status) ? status : 'unpaid';
    const paidAmt = st === 'paid' ? amt : Math.min(Number(paidAmount) || 0, st === 'partial' ? amt : 0);

    const due = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : `${period}-10`;

    const r = await pool.query(
      `INSERT INTO fee_records (student_id, amount, period, due_date, status, paid_amount, paid_date, method, remarks, created_by)
       VALUES ($1, $2, $3, $4::date, $5, $6, CASE WHEN $6 > 0 THEN CURRENT_DATE END, $7, $8, $9)
       RETURNING id`,
      [studentId, amt, period, due, st, paidAmt, method ?? null, remarks ?? null, req.user!.id],
    );
    res.status(201).json({ success: true, data: { id: r.rows[0].id } });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/finance/fees/:id — mark paid / partial / edit */
export async function updateFeeRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) throw createError('Invalid fee id', 400);

    const cur = (await pool.query('SELECT amount::float, status FROM fee_records WHERE id = $1', [id])).rows[0];
    if (!cur) throw createError('Fee record not found', 404);

    const { status, paidAmount, paidDate, method, remarks, amount } = req.body ?? {};
    const amt = amount != null ? Number(amount) : Number(cur.amount);
    const st = ['paid', 'partial', 'unpaid'].includes(status) ? status : cur.status;

    let paidAmt = paidAmount != null ? Number(paidAmount) : null;
    if (st === 'paid') paidAmt = amt;
    if (paidAmt == null) paidAmt = st === 'partial' ? Number(cur.amount) : 0;
    paidAmt = Math.max(0, Math.min(amt, paidAmt));

    const pDate = paidAmt > 0 ? (paidDate && DATE_RE.test(paidDate) ? paidDate : todayPKT()) : null;
    const cols: string[] = ['amount = $2', 'status = $3', 'paid_amount = $4', 'paid_date = $5', 'method = $6', 'remarks = $7'];
    const vals: (string | number | null)[] = [id, amt, st, paidAmt, pDate, method ?? null, remarks ?? null];

    await pool.query(`UPDATE fee_records SET ${cols.join(', ')} WHERE id = $1`, vals);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/finance/fees/:id */
export async function deleteFeeRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) throw createError('Invalid fee id', 400);
    const r = await pool.query('DELETE FROM fee_records WHERE id = $1 RETURNING id', [id]);
    if (!r.rows.length) throw createError('Fee record not found', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}