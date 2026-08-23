/**
 * analyticsService – aggregates attendance and test data for the dashboard.
 */
import { pool } from '../db';

export interface AttendanceSummary {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendancePercentage: number;
}

export interface StudentAttendanceTrend {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export interface LowAttendanceAlert {
  studentId: number;
  studentName: string;
  rollNumber: string;
  batchName: string;
  attendancePercent: number;
}

export interface BatchAttendanceSummary {
  batchId: number;
  batchName: string;
  grade: string;
  stream: string | null;
  totalStudents: number;
  averageAttendance: number;
}

/** Today's attendance snapshot for a batch (or all batches if batchId is undefined) */
export async function getTodayAttendanceSummary(batchId?: number): Promise<AttendanceSummary> {
  const today = new Date().toISOString().split('T')[0];

  const batchFilter = batchId ? 'AND a.batch_id = $2' : '';
  const params: (string | number)[] = [today];
  if (batchId) params.push(batchId);

  const res = await pool.query(
    `SELECT
       COUNT(*)                                    AS total,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END) AS absent
     FROM attendance a
     WHERE a.date = $1 ${batchFilter}`,
    params,
  );

  const row = res.rows[0];
  const total = Number(row.total) || 0;
  const present = Number(row.present) || 0;
  const absent = Number(row.absent) || 0;

  return {
    totalStudents: total,
    presentToday: present,
    absentToday: absent,
    attendancePercentage: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}

/** Day-by-day attendance trend for the last N days */
export async function getAttendanceTrend(
  days = 30,
  batchId?: number,
): Promise<StudentAttendanceTrend[]> {
  const batchFilter = batchId ? 'AND a.batch_id = $2' : '';
  const params: (string | number)[] = [days];
  if (batchId) params.push(batchId);

  const res = await pool.query(
    `SELECT
       a.date::text AS date,
       SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::int AS present,
       SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END)::int AS absent,
       SUM(CASE WHEN a.status = 'late'    THEN 1 ELSE 0 END)::int AS late,
       COUNT(*)::int AS total
     FROM attendance a
     WHERE a.date >= CURRENT_DATE - ($1 || ' days')::INTERVAL ${batchFilter}
     GROUP BY a.date
     ORDER BY a.date ASC`,
    params,
  );

  return res.rows;
}

/** Students with attendance below threshold (default 75%) */
export async function getLowAttendanceAlerts(
  threshold = 75,
  batchId?: number,
): Promise<LowAttendanceAlert[]> {
  const batchFilter = batchId ? 'AND s.batch_id = $2' : '';
  const params: (string | number)[] = [threshold / 100];
  if (batchId) params.push(batchId);

  const res = await pool.query(
    `SELECT
       s.id                                                       AS "studentId",
       s.name                                                     AS "studentName",
       COALESCE(s.roll_number, '')                                AS "rollNumber",
       CONCAT(b.grade, ' ', COALESCE(b.stream,''), ' ', b.name)  AS "batchName",
       ROUND(
         SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) /
         NULLIF(COUNT(a.id), 0) * 100
       )::int AS "attendancePercent"
     FROM students s
     JOIN batches b ON b.id = s.batch_id
     LEFT JOIN attendance a ON a.student_id = s.id
     WHERE s.status = 'active' ${batchFilter}
     GROUP BY s.id, s.name, s.roll_number, b.grade, b.stream, b.name
     HAVING
       SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) /
       NULLIF(COUNT(a.id), 0) < $1
     ORDER BY "attendancePercent" ASC`,
    params,
  );

  return res.rows;
}

/** Per-batch average attendance summary */
export async function getBatchAttendanceSummaries(): Promise<BatchAttendanceSummary[]> {
  const res = await pool.query(
    `SELECT
       b.id                                                        AS "batchId",
       b.name                                                      AS "batchName",
       b.grade,
       b.stream,
       COUNT(DISTINCT s.id)::int                                   AS "totalStudents",
       COALESCE(
         ROUND(
           SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) /
           NULLIF(COUNT(a.id),0) * 100
         )::int,
         0
       )                                                           AS "averageAttendance"
     FROM batches b
     LEFT JOIN students s ON s.batch_id = b.id AND s.status = 'active'
     LEFT JOIN attendance a ON a.student_id = s.id
     WHERE b.is_active = TRUE
     GROUP BY b.id, b.name, b.grade, b.stream
     ORDER BY b.grade, b.name`,
  );

  return res.rows;
}

/** Heatmap data: count of present students per day for the last N days */
export async function getAttendanceHeatmap(days = 90, batchId?: number) {
  const batchFilter = batchId ? 'AND batch_id = $2' : '';
  const params: (string | number)[] = [days];
  if (batchId) params.push(batchId);

  const res = await pool.query(
    `SELECT date::text, COUNT(*) FILTER (WHERE status = 'present')::int AS present
     FROM attendance
     WHERE date >= CURRENT_DATE - ($1 || ' days')::INTERVAL ${batchFilter}
     GROUP BY date
     ORDER BY date`,
    params,
  );

  return res.rows;
}
