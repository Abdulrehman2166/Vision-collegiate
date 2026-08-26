import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import type { JwtPayload } from '../middleware/authMiddleware';

export async function getTeacherBatchIds(userId: number): Promise<number[]> {
  const r = await pool.query(
    'SELECT batch_id FROM teacher_batches WHERE teacher_id = $1',
    [userId],
  );
  return r.rows.map((row) => Number(row.batch_id));
}

/** For teachers, restrict to assigned batches. Admins see all (undefined). */
export async function scopedBatchIds(user: JwtPayload): Promise<number[] | undefined> {
  if (user.role === 'admin') return undefined;
  if (user.role === 'teacher') return getTeacherBatchIds(user.id);
  return [];
}

export async function assertBatchAccess(user: JwtPayload, batchId: number): Promise<void> {
  if (user.role === 'admin') return;
  if (user.role === 'teacher') {
    const r = await pool.query(
      'SELECT 1 FROM teacher_batches WHERE teacher_id = $1 AND batch_id = $2',
      [user.id, batchId],
    );
    if (!r.rows.length) throw createError('Not assigned to this batch', 403);
    return;
  }
  throw createError('Not authorized for this batch', 403);
}

export async function canAccessStudent(user: JwtPayload, studentId: number): Promise<boolean> {
  if (user.role === 'admin') return true;

  if (user.role === 'teacher') {
    const r = await pool.query(
      `SELECT 1 FROM students s
       JOIN teacher_batches tb ON tb.batch_id = s.batch_id
       WHERE s.id = $1 AND tb.teacher_id = $2`,
      [studentId, user.id],
    );
    return r.rows.length > 0;
  }

  if (user.role === 'student') {
    const r = await pool.query(
      'SELECT 1 FROM students WHERE id = $1 AND user_id = $2',
      [studentId, user.id],
    );
    return r.rows.length > 0;
  }

  if (user.role === 'parent') {
    const r = await pool.query(
      `SELECT 1 FROM students s
       JOIN users u ON u.id = $2
       WHERE s.id = $1 AND (
         s.parent_user_id = $2
         OR (s.parent_email IS NOT NULL AND LOWER(s.parent_email) = LOWER(u.email))
       )`,
      [studentId, user.id],
    );
    return r.rows.length > 0;
  }

  return false;
}

export async function assertStudentAccess(user: JwtPayload, studentId: number): Promise<void> {
  const ok = await canAccessStudent(user, studentId);
  if (!ok) throw createError('Not authorized to access this student', 403);
}

export async function canAccessTest(
  user: JwtPayload,
  test: { batch_id: number | null; created_by: number | null },
): Promise<boolean> {
  if (user.role === 'admin') return true;

  if (user.role === 'teacher') {
    if (test.created_by === user.id) return true;
    if (!test.batch_id) return false;
    const r = await pool.query(
      'SELECT 1 FROM teacher_batches WHERE teacher_id = $1 AND batch_id = $2',
      [user.id, test.batch_id],
    );
    return r.rows.length > 0;
  }

  if (!test.batch_id) return false;

  if (user.role === 'student') {
    const r = await pool.query(
      'SELECT 1 FROM students WHERE user_id = $1 AND batch_id = $2 AND status = $3',
      [user.id, test.batch_id, 'active'],
    );
    return r.rows.length > 0;
  }

  if (user.role === 'parent') {
    const r = await pool.query(
      `SELECT 1 FROM students s
       JOIN users u ON u.id = $1
       WHERE s.batch_id = $2 AND s.status = 'active' AND (
         s.parent_user_id = $1
         OR (s.parent_email IS NOT NULL AND LOWER(s.parent_email) = LOWER(u.email))
       )`,
      [user.id, test.batch_id],
    );
    return r.rows.length > 0;
  }

  return false;
}

export async function assertTestAccess(
  user: JwtPayload,
  test: { batch_id: number | null; created_by: number | null },
): Promise<void> {
  const ok = await canAccessTest(user, test);
  if (!ok) throw createError('Not authorized to access this test', 403);
}

export function isStaff(user: JwtPayload): boolean {
  return user.role === 'admin' || user.role === 'teacher';
}
