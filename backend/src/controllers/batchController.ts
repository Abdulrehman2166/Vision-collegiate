import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';

const batchSchema = z.object({
  grade:     z.enum(['IX', 'X', 'XI', 'XII']),
  stream:    z.string().optional().nullable(),
  name:      z.string().min(1),
  is_active: z.boolean().optional(),
});

/** POST /api/v1/batches */
export async function createBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const data = batchSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO batches (grade, stream, name, is_active)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.grade, data.stream ?? null, data.name, data.is_active ?? true],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/batches */
export async function getAllBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.active !== 'false';
    const result = await pool.query(
      `SELECT b.*,
              COUNT(DISTINCT s.id)::int AS student_count,
              COUNT(DISTINCT tb.teacher_id)::int AS teacher_count
       FROM batches b
       LEFT JOIN students s ON s.batch_id = b.id AND s.status = 'active'
       LEFT JOIN teacher_batches tb ON tb.batch_id = b.id
       ${activeOnly ? 'WHERE b.is_active = TRUE' : ''}
       GROUP BY b.id
       ORDER BY b.grade, b.stream, b.name`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/batches/:id */
export async function getBatchById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const batchRes = await pool.query(
      `SELECT b.*, COUNT(DISTINCT s.id)::int AS student_count
       FROM batches b
       LEFT JOIN students s ON s.batch_id = b.id AND s.status = 'active'
       WHERE b.id = $1
       GROUP BY b.id`,
      [id],
    );
    if (!batchRes.rows.length) throw createError('Batch not found', 404);

    // Fetch assigned teachers
    const teachersRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone
       FROM users u
       JOIN teacher_batches tb ON tb.teacher_id = u.id
       WHERE tb.batch_id = $1 AND u.is_active = TRUE`,
      [id],
    );

    res.json({ success: true, data: { ...batchRes.rows[0], teachers: teachersRes.rows } });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/batches/:id */
export async function updateBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = batchSchema.partial().parse(req.body);

    const existing = await pool.query('SELECT id FROM batches WHERE id = $1', [id]);
    if (!existing.rows.length) throw createError('Batch not found', 404);

    const fields = Object.keys(data) as (keyof typeof data)[];
    if (!fields.length) throw createError('No fields to update', 400);

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values     = fields.map((f) => (data as Record<string, unknown>)[f] ?? null);
    values.push(id);

    const result = await pool.query(
      `UPDATE batches SET ${setClauses} WHERE id = $${fields.length + 1} RETURNING *`,
      values,
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/batches/:id */
export async function deleteBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM batches WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) throw createError('Batch not found', 404);
    res.json({ success: true, message: 'Batch deleted' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/batches/:id/teachers  – assign a teacher to a batch */
export async function assignTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { teacher_id } = z.object({ teacher_id: z.number().int().positive() }).parse(req.body);

    // Verify teacher exists and has correct role
    const teacherRes = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'teacher' AND is_active = TRUE",
      [teacher_id],
    );
    if (!teacherRes.rows.length) throw createError('Teacher not found', 404);

    await pool.query(
      `INSERT INTO teacher_batches (teacher_id, batch_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [teacher_id, id],
    );

    res.json({ success: true, message: 'Teacher assigned to batch' });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/batches/:id/teachers/:teacherId */
export async function removeTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, teacherId } = req.params;
    await pool.query(
      'DELETE FROM teacher_batches WHERE batch_id = $1 AND teacher_id = $2',
      [id, teacherId],
    );
    res.json({ success: true, message: 'Teacher removed from batch' });
  } catch (err) {
    next(err);
  }
}
