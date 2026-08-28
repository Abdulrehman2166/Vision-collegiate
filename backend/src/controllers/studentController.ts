import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import { assertBatchAccess, assertStudentAccess, scopedBatchIds } from '../utils/access';

const studentSchema = z.object({
  name:          z.string().min(2),
  grade:         z.enum(['Juniors', 'IX', 'X', 'XI', 'XII']),
  stream:        z.string().optional().nullable(),
  batch_id:      z.number().int().positive().optional().nullable(),
  roll_number:   z.string().optional().nullable(),
  parent_name:   z.string().optional().nullable(),
  parent_phone:  z.string().optional().nullable(),
  parent_email:  z.string().email().optional().nullable(),
  parent_user_id: z.number().int().positive().optional().nullable(),
  date_of_birth: z.string().optional().nullable(), // ISO date string
  address:       z.string().optional().nullable(),
  user_id:       z.number().int().positive().optional().nullable(),
});

/** POST /api/v1/students */
export async function createStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const data = studentSchema.parse(req.body);
    for (const key of Object.keys(data)) {
      if ((data as Record<string, unknown>)[key] === '') (data as Record<string, unknown>)[key] = null;
    }

    // Check roll number uniqueness if provided
    if (data.roll_number) {
      const dup = await pool.query('SELECT id FROM students WHERE roll_number = $1', [data.roll_number]);
      if (dup.rows.length) throw createError('Roll number already in use', 409);
    }

    const result = await pool.query(
      `INSERT INTO students
         (name, grade, stream, batch_id, roll_number, parent_name, parent_phone, parent_email,
          parent_user_id, date_of_birth, address, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        data.name, data.grade, data.stream ?? null, data.batch_id ?? null,
        data.roll_number ?? null, data.parent_name ?? null, data.parent_phone ?? null,
        data.parent_email ?? null, data.parent_user_id ?? null,
        data.date_of_birth ?? null, data.address ?? null,
        data.user_id ?? null,
      ],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/students */
export async function getAllStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const grade    = req.query.grade    as string | undefined;
    const batchId  = req.query.batchId  ? parseInt(req.query.batchId as string) : undefined;
    const status   = req.query.status   as string | undefined;
    const search   = req.query.search   as string | undefined;

    const conditions: string[] = [];
    const params: (string | number | number[])[] = [];
    let p = 1;

    const allowedBatches = await scopedBatchIds(req.user!);
    if (allowedBatches) {
      if (allowedBatches.length === 0) {
        res.json({ success: true, data: [], meta: { total: 0, page, limit, pages: 0 } });
        return;
      }
      conditions.push(`s.batch_id = ANY($${p++}::int[])`);
      params.push(allowedBatches);
    }

    if (grade)    { conditions.push(`s.grade = $${p++}`);   params.push(grade); }
    if (batchId)  {
      if (allowedBatches && !allowedBatches.includes(batchId)) {
        throw createError('Not assigned to this batch', 403);
      }
      conditions.push(`s.batch_id = $${p++}`);
      params.push(batchId);
    }
    if (status)   { conditions.push(`s.status = $${p++}`);  params.push(status); }
    if (search)   {
      conditions.push(`(s.name ILIKE $${p} OR s.roll_number ILIKE $${p})`);
      params.push(`%${search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM students s ${where}`, params,
    );
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT s.*, b.name AS batch_name, b.grade AS batch_grade, b.stream AS batch_stream
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       ${where}
       ORDER BY (NULLIF(regexp_replace(s.roll_number, '[^0-9]', '', 'g'), '')::numeric) NULLS LAST, s.roll_number, s.name ASC
       LIMIT $${p} OFFSET $${p + 1}`,
      params,
    );

    res.json({
      success: true,
      data: dataRes.rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/students/:id */
export async function getStudentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const studentRes = await pool.query(
      `SELECT s.*, b.name AS batch_name, b.grade AS batch_grade, b.stream AS batch_stream
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       WHERE s.id = $1`,
      [id],
    );
    if (!studentRes.rows.length) throw createError('Student not found', 404);

    await assertStudentAccess(req.user!, Number(id));

    // Attendance aggregate
    const attRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('present','late'))::int AS present_days,
         COUNT(*) FILTER (WHERE status = 'absent')::int            AS absent_days,
         COUNT(*)::int                                             AS total_days,
         ROUND(
           COUNT(*) FILTER (WHERE status IN ('present','late'))::numeric /
           NULLIF(COUNT(*), 0) * 100
         )::int AS attendance_percent
       FROM attendance WHERE student_id = $1`,
      [id],
    );

    res.json({
      success: true,
      data: { ...studentRes.rows[0], attendance: attRes.rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/students/:id */
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const data = studentSchema.partial().parse(req.body);
    for (const key of Object.keys(data)) {
      if ((data as Record<string, unknown>)[key] === '') (data as Record<string, unknown>)[key] = null;
    }

    const existing = await pool.query('SELECT id, batch_id FROM students WHERE id = $1', [id]);
    if (!existing.rows.length) throw createError('Student not found', 404);
    await assertStudentAccess(req.user!, Number(id));
    if (data.batch_id) await assertBatchAccess(req.user!, data.batch_id);

    // Build dynamic SET clause
    const fields = Object.keys(data) as (keyof typeof data)[];
    if (!fields.length) throw createError('No fields to update', 400);

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values     = fields.map((f) => (data as Record<string, unknown>)[f] ?? null);
    values.push(id);

    const result = await pool.query(
      `UPDATE students SET ${setClauses}, updated_at = now() WHERE id = $${fields.length + 1} RETURNING *`,
      values,
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/students/:id  (admin only) */
export async function deleteStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE students SET status = 'inactive', updated_at = now() WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rows.length) throw createError('Student not found', 404);
    res.json({ success: true, message: 'Student deactivated' });
  } catch (err) {
    next(err);
  }
}
