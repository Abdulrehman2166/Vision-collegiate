/**
 * intelligenceController – classic statistics / data-science techniques applied
 * to the institute's real data:
 *
 *   - Forecast:    ordinary least-squares regression on the attendance trend,
 *                  projected N days ahead with R² goodness-of-fit.
 *   - Distribution: score histogram (decile buckets) + percentiles (p10..p90).
 *   - Correlation:  Pearson r between attendance & academic performance, with
 *                  a t-statistic significance test + scatter samples.
 *   - At-risk:      per-student risk engine combining attendance, average marks
 *                  and the slope of recent performance (trend direction).
 *
 * Everything is computed live from attendance + test_results — no schema change.
 */
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { getWorkingDate } from '../services/settingsService';

// ─── Math helpers ──────────────────────────────────────────────────────────────

interface Point { x: number; y: number }

/** Ordinary least-squares linear fit. Returns slope/intercept/R² and a predictor. */
function leastSquares(points: Point[]) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0, predict: (_x: number) => 0 };
  const meanX = points.reduce((a, p) => a + p.x, 0) / n;
  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0, den = 0, ssRes = 0, ssTot = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope     = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  for (const p of points) {
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return { slope, intercept, r2, predict: (x: number) => slope * x + intercept };
}

function pearson(pts: Point[]) {
  const n = pts.length;
  if (n < 2) return { r: 0, t: 0, n };
  const meanX = pts.reduce((a, p) => a + p.x, 0) / n;
  const meanY = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) ** 2;
    syy += (p.y - meanY) ** 2;
  }
  if (sxx === 0 || syy === 0) return { r: 0, t: 0, n };
  const r = sxy / Math.sqrt(sxx * syy);
  const rC = Math.max(-0.9999, Math.min(0.9999, r));
  const t = rC * Math.sqrt((n - 2) / (1 - rC * rC));
  return { r, t, n };
}

// ─── GET /analytics/intelligence/forecast?days=30 ─────────────────────────────-
export async function getForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30));
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const batchFilter = batchId ? 'AND a.batch_id = $2' : '';
    const params: (string | number)[] = [days];
    if (batchId) params.push(batchId);

    const rows = (await pool.query(
      `SELECT a.date::text AS date,
              COUNT(*)::int AS total,
              (SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) / COUNT(*)) * 100 AS pct
       FROM attendance a
       WHERE a.date >= CURRENT_DATE - ($1 || ' days')::INTERVAL ${batchFilter}
       GROUP BY a.date
       ORDER BY a.date ASC`,
      params,
    )).rows;

    const today = await getWorkingDate();
    const series = rows.map((r, i) => ({ date: r.date, pct: Math.round(Number(r.pct) * 10) / 10, total: Number(r.total) }))
      .filter((p) => p.total > 0 || p.date === today);

    const points: Point[] = series.map((s, i) => ({ x: i, y: s.pct }));
    const fit = leastSquares(points.filter((p) => Number.isFinite(p.y)));

    const forecast: { date: string; pct: number }[] = [];
    for (let k = 1; k <= 7; k++) {
      const dt = new Date();
      dt.setDate(dt.getDate() + k);
      forecast.push({
        date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
        pct: Math.max(0, Math.min(100, Math.round(fit.predict(series.length - 1 + k) * 10) / 10)),
      });
    }

    // Weekly buckets for a compact cohort view
    const weekBuckets: { label: string; pct: number }[] = [];
    for (let w = 0; w * 7 < series.length; w++) {
      const slice = series.slice(w * 7, w * 7 + 7);
      const avg = slice.reduce((a, s) => a + s.pct, 0) / (slice.length || 1);
      weekBuckets.push({ label: `W${w + 1}`, pct: Math.round(avg * 10) / 10 });
    }

    res.json({
      success: true,
      data: {
        series,
        forecast,
        weekBuckets,
        regression: { slope: Math.round(fit.slope * 100) / 100, intercept: Math.round(fit.intercept * 10) / 10, r2: Math.round(fit.r2 * 100) / 100 },
        direction: fit.slope > 0.05 ? 'rising' : fit.slope < -0.05 ? 'declining' : 'stable',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /analytics/intelligence/performance-distribution?batchId= ─────────────
export async function getPerformanceDistribution(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const batchFilter = batchId ? 'AND s.batch_id = $1' : '';
    const params: (string | number)[] = [];
    if (batchId) params.push(batchId);

    const rows = (await pool.query(
      `SELECT s.id,
              ROUND(AVG(tr.marks_obtained / NULLIF(COALESCE(tr.total_marks, t.total_marks), 0) * 100))::int AS pct
       FROM test_results tr
       JOIN tests t    ON t.id = tr.test_id
       JOIN students s ON s.id = tr.student_id
       WHERE s.status = 'active' ${batchFilter}
       GROUP BY s.id`,
      params,
    )).rows.map((r) => Number(r.pct));

    const buckets = Array.from({ length: 11 }, (_, i) => ({ label: `${i * 10}-${i * 10 + 9}`, count: 0, color: '' }));
    for (const p of rows) {
      const k = Math.max(0, Math.min(10, Math.floor(p / 10)));
      buckets[k].count += 1;
    }

    const sorted = [...rows].sort((a, b) => a - b);
    const percentile = (q: number) => {
      if (!sorted.length) return 0;
      const idx = Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length));
      return sorted[idx];
    };

    res.json({
      success: true,
      data: {
        sampleSize: rows.length,
        mean: rows.length ? Math.round(rows.reduce((a, b) => a + b, 0) / rows.length) : 0,
        median: percentile(50),
        p10: percentile(10), p25: percentile(25), p75: percentile(75), p90: percentile(90),
        stdDev: rows.length
          ? Math.round(Math.sqrt(rows.reduce((a, p) => a + (p - (rows.reduce((x, y) => x + y, 0) / rows.length)) ** 2, 0) / rows.length))
          : 0,
        buckets,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /analytics/intelligence/correlation?batchId= ──────────────────────────
export async function getCorrelation(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;

    const rows = (await pool.query(
      `SELECT s.id AS "studentId", s.name,
              ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) * 100)::int AS attendance,
              ROUND(AVG(CASE WHEN tr.total_marks > 0 THEN (tr.marks_obtained / tr.total_marks) * 100 END))::int AS academic
       FROM students s
       LEFT JOIN attendance a    ON a.student_id = s.id
       LEFT JOIN test_results tr ON tr.student_id = s.id
       JOIN batches b ON b.id = s.batch_id
       WHERE s.status = 'active' ${batchId ? 'AND s.batch_id = $1' : ''}
       GROUP BY s.id, s.name`,
      batchId ? [batchId] : [],
    )).rows
      .filter((r) => r.attendance != null && r.academic != null)
      .map((r) => ({ studentId: Number(r.studentId), name: String(r.name), attendance: Number(r.attendance), academic: Number(r.academic) }));

    const pts = rows.map((r) => ({ x: r.attendance, y: r.academic }));
    const { r: rVal, t, n } = pearson(pts);
    const significant = Math.abs(t) > 1.96;

    res.json({
      success: true,
      data: {
        r: Math.round(rVal * 1000) / 1000,
        t: Math.round(t * 100) / 100,
        n,
        significant,
        strength: Math.abs(rVal) < 0.2 ? 'weak' : Math.abs(rVal) < 0.6 ? 'moderate' : 'strong',
        scatter: rows.map((r) => ({ name: r.name, attendance: r.attendance, academic: r.academic })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /analytics/intelligence/at-risk?batchId=&minTests=3 ───────────────────
export async function getAtRisk(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const minTests = Math.max(1, parseInt(req.query.minTests as string) || 2);
    const batchFilter = batchId ? 'AND s.batch_id = $1' : '';
    const params: (string | number)[] = [];
    if (batchId) params.push(batchId);

    const students = (await pool.query(
      `SELECT s.id,
              ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) * 100)::int AS attendance,
              COUNT(DISTINCT tr.test_id)::int AS testsTaken
       FROM students s
       LEFT JOIN attendance a    ON a.student_id = s.id
       LEFT JOIN test_results tr ON tr.student_id = s.id
       WHERE s.status = 'active' ${batchFilter}
       GROUP BY s.id`,
      params,
    )).rows;

    // each student's recent marks % in date order (for slope)
    const marksRes = await pool.query(
      `SELECT tr.student_id AS id, tr.marks_obtained::float AS marks,
              COALESCE(tr.total_marks, t.total_marks)::float AS total,
              t.test_date AS date
       FROM test_results tr
       JOIN tests t ON t.id = tr.test_id
       JOIN students s ON s.id = tr.student_id
       WHERE s.status = 'active' ${batchId ? 'AND s.batch_id = $1' : ''}
       ORDER BY tr.student_id, t.test_date ASC NULLS LAST, t.id ASC`,
      batchId ? [batchId] : [],
    );

    const byStudent = new Map<number, { pct: number; date: string | null }[]>();
    for (const r of marksRes.rows) {
      const pct = Number(r.total) > 0 ? (Number(r.marks) / Number(r.total)) * 100 : 0;
      const list = byStudent.get(Number(r.id)) ?? [];
      list.push({ pct, date: r.date ? String(r.date) : null });
      byStudent.set(Number(r.id), list);
    }

    const nameRes = await pool.query(
      `SELECT s.id, s.name, COALESCE(s.roll_number,'') AS "rollNumber", b.name AS "batchName", b.grade AS grade
       FROM students s JOIN batches b ON b.id = s.batch_id
       WHERE s.status = 'active' ${batchFilter}`,
      batchId ? [batchId] : [],
    );
    const names = new Map<number, { name: string; rollNumber: string; batchName: string; grade: string }>(
      nameRes.rows.map((r) => [Number(r.id), { name: r.name, rollNumber: r.rollNumber, batchName: r.batchName, grade: r.grade }]),
    );

    const out: { studentId: number; name: string; rollNumber: string; batchName: string; grade: string; risk: number; level: string; attendance: number; average: number; slope: number; testsTaken: number; reasons: string[] }[] = [];

    for (const s of students) {
      const id = Number(s.id);
      const attendance = Number(s.attendance) ?? 0;
      const marks = byStudent.get(id) ?? [];
      const avg = marks.length ? marks.reduce((a, m) => a + m.pct, 0) / marks.length : 0;
      const testsTaken = Number(s.testsTaken) || 0;

      const slope = marks.length >= minTests
        ? leastSquares(marks.map((m, i) => ({ x: i, y: m.pct }))).slope
        : 0;

      let risk = 0;
      const reasons: string[] = [];
      if (attendance < 75) { risk += 32; reasons.push(`Low attendance (${attendance}%)`); }
      else if (attendance < 85) { risk += 14; reasons.push(`Dipping attendance (${attendance}%)`); }
      if (avg < 45) { risk += 32; reasons.push(`Weak averages (${Math.round(avg)}%)`); }
      if (slope < -5) { risk += 24; reasons.push(`Rapid decline (${Math.round(slope * 10) / 10}%/test)`); }
      else if (slope < -1.5) { risk += 12; reasons.push(`Slipping (${Math.round(slope * 10) / 10}%/test)`); }
      if (testsTaken < 3 && testsTaken > 0) { risk += 8; reasons.push(`Only ${testsTaken} tests taken`); }
      risk = Math.max(0, Math.min(100, risk));

      if (risk >= 25) {
        const info = names.get(id) ?? { name: 'Student', rollNumber: '', batchName: '', grade: '' };
        out.push({
          studentId: id,
          name: info.name,
          rollNumber: info.rollNumber,
          batchName: info.batchName,
          grade: info.grade,
          risk,
          level: risk >= 60 ? 'critical' : risk >= 40 ? 'high' : 'watch',
          attendance,
          average: Math.round(avg),
          slope: Math.round(slope * 10) / 10,
          testsTaken,
          reasons,
        });
      }
    }

    out.sort((a, b) => b.risk - a.risk);
    res.json({ success: true, data: out });
  } catch (err) {
    next(err);
  }
}