import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';

const entrySchema = z.object({
  grade:   z.enum(['IX', 'X', 'XI', 'XII']),
  week:    z.number().int().min(1).max(4),
  day:     z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
  subject: z.string().min(1),
  teacher: z.string().nullable().optional(),
});

/** GET /api/v1/schedule — full weekly test schedule, grouped by grade → week → day */
export async function getTestSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await pool.query(
      `SELECT grade, week, day, subject, teacher
       FROM test_schedule
       ORDER BY
         CASE grade WHEN 'IX' THEN 1 WHEN 'X' THEN 2 WHEN 'XI' THEN 3 WHEN 'XII' THEN 4 END,
         week,
         CASE day WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3 WHEN 'Thu' THEN 4 WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 END`,
    );

    const byGrade = new Map<string, Record<number, Record<string, { subject: string; teacher: string | null }>>>();
    for (const r of rows.rows) {
      if (!byGrade.has(r.grade)) byGrade.set(r.grade, {});
      const weeks = byGrade.get(r.grade)!;
      if (!weeks[r.week]) weeks[r.week] = {};
      weeks[r.week][r.day] = { subject: r.subject, teacher: r.teacher };
    }

    res.json({
      success: true,
      data: {
        grades: [...byGrade.entries()].map(([grade, weeks]) => ({
          grade,
          weeks: [1, 2, 3, 4].map((w) => ({
            week: w,
            days: (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)
              .filter((d) => weeks[w]?.[d])
              .map((d) => ({ day: d, ...weeks[w][d] })),
          })),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/schedule — replace the whole schedule (admin) */
export async function updateTestSchedule(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    const schema = z.object({ entries: z.array(entrySchema) });
    const data = schema.parse(req.body);
    if (!data.entries.length) throw createError('At least one schedule entry is required', 400);

    await client.query('BEGIN');
    await client.query('DELETE FROM test_schedule');
    for (const e of data.entries) {
      await client.query(
        `INSERT INTO test_schedule (grade, week, day, subject, teacher)
         VALUES ($1,$2,$3,$4,$5)`,
        [e.grade, e.week, e.day, e.subject, e.teacher ?? null],
      );
    }
    await client.query('COMMIT');

    res.json({ success: true, data: { saved: data.entries.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}