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
import { scopedBatchIds } from '../utils/access';
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

  const base: Omit<PerformanceStudent, 'rank'>[] = res.rows.map((r: Record<string, unknown>) => {
    const attendance = r.attendancePercent != null ? Number(r.attendancePercent) : null;
    const academic   = r.testPercent       != null ? Number(r.testPercent)       : null;
    const testsTaken = Number(r.testsTaken) || 0;

    const attScore = attendance ?? 0;
    const acaScore = academic ?? 0;
    let iq = Math.round(attScore * 0.45 + acaScore * 0.55);
    if ((attendance ?? 0) >= 80)            iq = Math.min(100, iq + 4);   // consistency kicker
    if (testsTaken === 0 && academic == null) iq = Math.round((attScore * 0.45 + 50 * 0.55));
    iq = Math.max(0, Math.min(100, iq));

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
      rank: 0,
      role,
      roleIcon,
      lastTestDate: r.lastTestDate ? String(r.lastTestDate) : null,
    };
  });

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