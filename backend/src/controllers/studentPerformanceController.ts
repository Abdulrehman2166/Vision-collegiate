/**
 * performanceService – futuristic "Performance IQ" scoring layer.
 *
 * Derives a gamified 0-100 IQ from each student's REAL data:
 *   - attendance consistency (present rate over all recorded sessions)
 *   - academic output (average percentage across test results)
 *   - consistency bonus (≥80% attendance) and engagement kicker (test volume)
 *
 * No schema changes — everything is computed live from attendance + test_results.
 */
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { scopedBatchIds, assertStudentAccess } from '../utils/access';
import { createError } from '../middleware/errorHandler';
import type { JwtPayload } from '../middleware/authMiddleware';

export interface PerformanceStudent {
  studentId: number;
  name: string;
  rollNumber: string | null;
  grade: string;
  stream: string | null;
  batchName: string | null;
  attendancePercent: number | null;
  testPercent: number | null;
  testsTaken: number;
  performanceIQ: number;
  tier: 'S' | 'A' | 'B' | 'C';
  tierColor: string;
  rank: number;
  streak: number;
  role: string;
  roleIcon: string;
  lastTestDate: string | null;
}

const TIERS: Record<'S' | 'A' | 'B' | 'C', { color: string; label: string }> = {
  S: { color: '#f59e0b', label: 'ELITE' },
  A: { color: '#a855f7', label: 'ADVANCED' },
  B: { color: '#6366f1', label: 'PROGRESSING' },
  C: { color: '#38bdf8', label: 'DEVELOPING' },
};

/** Futuristic role + avatar based on the dominant skill axis. */
function deriveRole(t: { attendancePercent: number | null; testPercent: number | null; testsTaken: number }): { role: string; roleIcon: string } {
  const att = t.attendancePercent ?? 50;
  const aca = t.testPercent ?? 50;
  if (att >= 92 && aca >= 80) return { role: 'Commander',   roleIcon: '👑' };
  if (aca >= 80)              return { role: 'Strategist',  roleIcon: '♛' };
  if (aca >= 65)              return { role: 'Tactician',   roleIcon: '⚔️' };
  if (att < 60)               return { role: 'Rising Star', roleIcon: '🌱' };
  return { role: 'Pathfinder', roleIcon: '🧭' };
}

/** Consecutive streak: newest recorded attendance days where student was present. */
export async function getStudentStreak(studentId: number): Promise<number> {
  const res = await pool.query(
    `WITH listed AS (
       SELECT date, status,
              ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
       FROM attendance
       WHERE student_id = $1
     ),
     flagged AS (
       SELECT date, status, rn,
              (status != 'present')::int AS break_row
       FROM listed
     )
     SELECT COUNT(*)::int AS streak
     FROM (
       SELECT rn, SUM(break_row) OVER (ORDER BY rn) AS breaks
       FROM flagged
     ) seq
     WHERE seq.breaks = 0`,
    [studentId],
  );
  return Number(res.rows[0]?.streak) || 0;
}

/** Shared IQ computation — single source of truth. */
function computeIq(attendance: number | null, academic: number | null, testsTaken: number): number {
  const attScore = attendance ?? 0;
  const acaScore = academic ?? 0;
  let iq = Math.round(attScore * 0.45 + acaScore * 0.55);
  if ((attendance ?? 0) >= 80) iq = Math.min(100, iq + 4);   // consistency kicker
  if (testsTaken === 0 && academic == null) iq = Math.round((attScore * 0.45 + 50 * 0.55));
  return Math.max(0, Math.min(100, iq));
}

/** Map an aggregated student row to a persona (minus rank). */
function buildRow(r: Record<string, unknown>): Omit<PerformanceStudent, 'rank'> {
  const attendance = r.attendancePercent != null ? Number(r.attendancePercent) : null;
  const academic   = r.testPercent       != null ? Number(r.testPercent)       : null;
  const testsTaken = Number(r.testsTaken) || 0;

  const iq    = computeIq(attendance, academic, testsTaken);
  const tier: PerformanceStudent['tier'] = iq >= 80 ? 'S' : iq >= 65 ? 'A' : iq >= 45 ? 'B' : 'C';
  const { role, roleIcon } = deriveRole({ attendancePercent: attendance, testPercent: academic, testsTaken });

  return {
    studentId: Number(r.studentId),
    name:      String(r.name),
    rollNumber: r.rollNumber ? String(r.rollNumber) : null,
    grade:     String(r.grade),
    stream:    r.stream ? String(r.stream) : null,
    batchName: r.batchName ? String(r.batchName) : null,
    attendancePercent: attendance,
    testPercent: academic,
    testsTaken,
    performanceIQ: iq,
    tier,
    tierColor: TIERS[tier].color,
    streak: 0,
    role,
    roleIcon,
    lastTestDate: r.lastTestDate ? String(r.lastTestDate) : null,
  };
}

async function performanceRows(reqUser: JwtPayload): Promise<{ base: Omit<PerformanceStudent, 'rank'>[] ; ranks: Map<number, number> }> {
  const allowed = await scopedBatchIds(reqUser);
  if (allowed && allowed.length === 0) {
    return { base: [], ranks: new Map() };
  }

  const batchFilter = allowed
    ? 'AND s.batch_id = ANY($1::int[])'
    : '';
  const params: unknown[] = [];
  if (allowed) params.push(allowed);

  const res = await pool.query(
    `SELECT
       s.id                                                              AS "studentId",
       s.name,
       s.roll_number                                                     AS "rollNumber",
       s.grade,
       s.stream,
       b.name                                                            AS "batchName",
       ROUND(
         AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) * 100
       )::int                                                            AS "attendancePercent",
       ROUND(
         AVG(CASE WHEN tr.total_marks > 0 THEN (tr.marks_obtained / tr.total_marks) * 100 END)
       )::int                                                            AS "testPercent",
       COUNT(DISTINCT tr.test_id)::int                                   AS "testsTaken",
       MAX(tr.updated_at)::text                                          AS "lastTestDate"
     FROM students s
     JOIN batches b ON b.id = s.batch_id
     LEFT JOIN attendance a      ON a.student_id = s.id
     LEFT JOIN test_results tr   ON tr.student_id = s.id
     WHERE s.status = 'active' ${batchFilter}
     GROUP BY s.id, s.name, s.roll_number, s.grade, s.stream, b.name
     ORDER BY s.name ASC`,
    params,
  );

  const base: Omit<PerformanceStudent, 'rank'>[] = res.rows.map((r) => buildRow(r as Record<string, unknown>));

  // Inject streak for the current page set (cheap, one query per student)
  const withStreak = await Promise.all(base.map(async (s) => ({ ...s, streak: await getStudentStreak(s.studentId) })));

  // Rank by IQ, then attendance, then tests taken
  const sorted = [...withStreak].sort(
    (a, b) => b.performanceIQ - a.performanceIQ || (b.attendancePercent ?? 0) - (a.attendancePercent ?? 0) || b.testsTaken - a.testsTaken,
  );
  const ranks = new Map<number, number>();
  sorted.forEach((s, i) => ranks.set(s.studentId, i + 1));

  return { base: sorted, ranks };
}

/** GET /api/v1/students/performance */
export async function getPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const { base, ranks } = await performanceRows(req.user!);
    const rows: PerformanceStudent[] = base.map((s) => ({ ...s, rank: ranks.get(s.studentId) ?? 0 }));
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/** Persona for a single student (any scope — access already asserted). */
async function singlePerformanceRow(studentId: number): Promise<Omit<PerformanceStudent, 'rank'> | null> {
  const res = await pool.query(
    `SELECT
       s.id                                                              AS "studentId",
       s.name,
       s.roll_number                                                     AS "rollNumber",
       s.grade,
       s.stream,
       b.name                                                            AS "batchName",
       ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) * 100)::int AS "attendancePercent",
       ROUND(AVG(CASE WHEN tr.total_marks > 0 THEN (tr.marks_obtained / tr.total_marks) * 100 END))::int AS "testPercent",
       COUNT(DISTINCT tr.test_id)::int                                   AS "testsTaken",
       MAX(tr.updated_at)::text                                          AS "lastTestDate"
     FROM students s
     JOIN batches b ON b.id = s.batch_id
     LEFT JOIN attendance a    ON a.student_id = s.id
     LEFT JOIN test_results tr ON tr.student_id = s.id
     WHERE s.status = 'active' AND s.id = $1
     GROUP BY s.id, s.name, s.roll_number, s.grade, s.stream, b.name
     LIMIT 1`,
    [studentId],
  );
  if (!res.rows.length) return null;
  return buildRow(res.rows[0] as Record<string, unknown>);
}

/** Rank of a student against ALL active students (student/parent view). */
async function globalRankFor(studentId: number): Promise<number> {
  const res = await pool.query(
    `SELECT s.id,
            ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) * 100)::int AS att,
            ROUND(AVG(CASE WHEN tr.total_marks > 0 THEN (tr.marks_obtained / tr.total_marks) * 100 END))::int AS aca,
            COUNT(DISTINCT tr.test_id)::int AS tt
     FROM students s
     LEFT JOIN attendance a    ON a.student_id = s.id
     LEFT JOIN test_results tr ON tr.student_id = s.id
     WHERE s.status = 'active'
     GROUP BY s.id`,
  );
  const scored = res.rows.map((r) => ({
    id: Number(r.id),
    iq: computeIq(r.att != null ? Number(r.att) : null, r.aca != null ? Number(r.aca) : null, Number(r.tt) || 0),
  }));
  scored.sort((a, b) => b.iq - a.iq);
  const idx = scored.findIndex((s) => s.id === studentId);
  if (idx === -1) throw createError('Student not found', 404);
  return idx + 1;
}

export interface StudentProgress {
  persona: PerformanceStudent;
  results: {
    id: number;
    title: string;
    subject: string;
    date: string | null;
    marks: number;
    total: number;
    percent: number | null;
  }[];
  attendanceTrend: { date: string; status: string }[];
}

/** GET /api/v1/students/:id/performance — a student's own progress portal payload. */
export async function getStudentProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId <= 0) throw createError('Invalid student id', 400);
    await assertStudentAccess(req.user!, studentId);

    let persona: PerformanceStudent;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'teacher';
    if (isStaff) {
      const { base, ranks } = await performanceRows(req.user!);
      const found = base.find((s) => s.studentId === studentId);
      if (!found) throw createError('Student not found', 404);
      persona = { ...found, rank: ranks.get(studentId) ?? 0 };
    } else {
      const row = await singlePerformanceRow(studentId);
      if (!row) throw createError('Student not found', 404);
      persona = { ...row, rank: await globalRankFor(studentId) };
    }

    const [resultsRes, attRes] = await Promise.all([
      pool.query(
        `SELECT t.id, t.title, t.subject, to_char(t.test_date, 'YYYY-MM-DD') AS date,
                tr.marks_obtained::float AS marks,
                COALESCE(tr.total_marks, t.total_marks)::float AS total
         FROM test_results tr
         JOIN tests t ON t.id = tr.test_id
         WHERE tr.student_id = $1
         ORDER BY t.test_date DESC NULLS LAST, t.id DESC
         LIMIT 60`,
        [studentId],
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS date, status
         FROM attendance
         WHERE student_id = $1
         ORDER BY date ASC
         LIMIT 60`,
        [studentId],
      ),
    ]);

    const results = resultsRes.rows.map((r) => ({
      id:      Number(r.id),
      title:   String(r.title ?? 'Test'),
      subject: String(r.subject),
      date:    r.date ? String(r.date) : null,
      marks:   Number(r.marks),
      total:   Number(r.total) || 0,
      percent: Number(r.total) > 0 ? Math.round((Number(r.marks) / Number(r.total)) * 100) : null,
    }));

    const attendanceTrend = attRes.rows.map((r) => ({ date: String(r.date), status: String(r.status) }));

    res.json({ success: true, data: { persona, results, attendanceTrend } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/students/linked — the students linked to the logged-in user (student → self, parent → children). */
export async function getMyStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const u = req.user!;
    let rows;
    if (u.role === 'student') {
      const r = await pool.query(
        `SELECT id, name, roll_number AS "rollNumber", grade, stream
         FROM students WHERE user_id = $1 AND status = 'active'
         ORDER BY name`,
        [u.id],
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT s.id, s.name, s.roll_number AS "rollNumber", s.grade, s.stream
         FROM students s
         JOIN users u ON u.id = $1
         WHERE s.status = 'active' AND (
           s.parent_user_id = $1
           OR (s.parent_email IS NOT NULL AND LOWER(s.parent_email) = LOWER(u.email))
         )
         ORDER BY s.name`,
        [u.id],
      );
      rows = r.rows;
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}