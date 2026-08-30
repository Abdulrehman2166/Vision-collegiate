import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import * as pdfService from '../services/pdfService';
import * as storageService from '../services/storageService';
import { assertBatchAccess, assertTestAccess, assertStudentAccess, scopedBatchIds } from '../utils/access';

/** POST /api/v1/tests/:id/marks — bulk save marks for a test */
export async function saveTestMarks(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const testId = parseInt(id, 10);
    if (isNaN(testId)) throw createError('Invalid test id', 400);

    const testRes = await pool.query('SELECT * FROM tests WHERE id = $1', [testId]);
    if (!testRes.rows.length) throw createError('Test not found', 404);
    const test = testRes.rows[0];
    await assertTestAccess(req.user!, test);
    if (test.batch_id) await assertBatchAccess(req.user!, Number(test.batch_id));

    const schema = z.object({
      records: z.array(
        z.object({
          studentId: z.number().int().positive(),
          marks:     z.number().min(0).max(test.total_marks),
        }),
      ).min(1),
    });
    const data = schema.parse(req.body);

    // Verify every student belongs to the test's batch (or same grade when batch is null)
    let rosterCheck: { id: number }[];
    if (test.batch_id) {
      const r = await pool.query(
        `SELECT id FROM students WHERE batch_id = $1 AND status = 'active' AND id = ANY($2::int[])`,
        [test.batch_id, data.records.map((r) => r.studentId)],
      );
      rosterCheck = r.rows;
    } else {
      const r = await pool.query(
        `SELECT id FROM students WHERE grade = $1 AND status = 'active' AND id = ANY($2::int[])`,
        [test.grade, data.records.map((r) => r.studentId)],
      );
      rosterCheck = r.rows;
    }
    if (rosterCheck.length !== data.records.length) {
      throw createError('One or more students are not in this test\'s batch/grade', 400);
    }

    await client.query('BEGIN');
    for (const rec of data.records) {
      await client.query(
        `INSERT INTO test_results (test_id, student_id, marks_obtained, recorded_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (test_id, student_id)
         DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, recorded_by = EXCLUDED.recorded_by, updated_at = now()`,
        [testId, rec.studentId, rec.marks, req.user!.id],
      );
    }
    await client.query('COMMIT');

    res.json({ success: true, data: { testId, saved: data.records.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/** GET /api/v1/tests/:id/marks — roster with current marks for the test */
export async function getTestMarks(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const testId = parseInt(id, 10);
    if (isNaN(testId)) throw createError('Invalid test id', 400);

    const testRes = await pool.query('SELECT * FROM tests WHERE id = $1', [testId]);
    if (!testRes.rows.length) throw createError('Test not found', 404);
    const test = testRes.rows[0];
    await assertTestAccess(req.user!, test);
    if (test.batch_id) await assertBatchAccess(req.user!, Number(test.batch_id));

    let students;
    if (test.batch_id) {
      students = await pool.query(
        `SELECT s.id AS "studentId", s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                tr.marks_obtained AS "marks", tr.updated_at AS "updatedAt"
         FROM students s
         LEFT JOIN test_results tr ON tr.student_id = s.id AND tr.test_id = $1
         WHERE s.batch_id = $2 AND s.status = 'active'
         ORDER BY s.roll_number, s.name`,
        [testId, test.batch_id],
      );
    } else {
      students = await pool.query(
        `SELECT s.id AS "studentId", s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                tr.marks_obtained AS "marks", tr.updated_at AS "updatedAt"
         FROM students s
         LEFT JOIN test_results tr ON tr.student_id = s.id AND tr.test_id = $1
         WHERE s.grade = $2 AND s.status = 'active'
         ORDER BY s.roll_number, s.name`,
        [testId, test.grade],
      );
    }

    res.json({
      success: true,
      data: {
        test: {
          id:          test.id,
          title:       test.title,
          subject:     test.subject,
          total_marks: test.total_marks,
          test_date:   test.test_date,
          batch_id:    test.batch_id,
          grade:       test.grade,
        },
        students: students.rows.map((s) => ({
          studentId:   Number(s.studentId),
          studentName: s.studentName,
          rollNumber:  s.rollNumber,
          marks:       s.marks == null ? null : Number(s.marks),
          updatedAt:   s.updatedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/tests/reports/monthly-analytics — generate monthly analytics PDF */
export async function generateMonthlyAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      month:     z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
      batchId:   z.number().int().positive().optional(),
      studentId: z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);

    let scopeBatchIds: number[] | undefined;
    if (data.batchId) {
      await assertBatchAccess(req.user!, data.batchId);
      scopeBatchIds = [data.batchId];
    } else {
      scopeBatchIds = await scopedBatchIds(req.user!);
      if (req.user!.role === 'teacher' && scopeBatchIds?.length === 0) {
        throw createError('No batches assigned to you', 403);
      }
    }

    if (data.studentId) await assertStudentAccess(req.user!, data.studentId);

    // Roster: active students in scope (all when admin without batchId)
    let roster;
    if (scopeBatchIds) {
      roster = await pool.query(
        `SELECT s.id, s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber", b.id AS "batchId", b.name AS "batchName"
         FROM students s JOIN batches b ON b.id = s.batch_id
         WHERE s.status = 'active' AND b.id = ANY($1::int[])
         ORDER BY b.id, s.roll_number, s.name`,
        [scopeBatchIds],
      );
    } else {
      roster = await pool.query(
        `SELECT s.id, s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber", b.id AS "batchId", b.name AS "batchName"
         FROM students s JOIN batches b ON b.id = s.batch_id
         WHERE s.status = 'active'
         ORDER BY b.id, s.roll_number, s.name`,
      );
    }

    const rosterRows = data.studentId ? roster.rows.filter((r) => Number(r.id) === data.studentId) : roster.rows;
    if (!rosterRows.length) {
      throw createError(data.studentId ? 'Student not found in scope' : 'No active students found', 404);
    }

    // Tests in the month (scoped) with their results
    let tests;
    if (scopeBatchIds) {
      tests = await pool.query(
        `SELECT t.id AS "testId", t.title, t.subject, t.total_marks::float AS "totalMarks",
                to_char(t.test_date, 'YYYY-MM-DD') AS date, s.id AS "studentId", tr.marks_obtained::float AS "marks"
         FROM tests t
         JOIN test_results tr ON tr.test_id = t.id
         JOIN students     s  ON s.id = tr.student_id
         WHERE t.test_date IS NOT NULL AND to_char(t.test_date, 'YYYY-MM') = $1
           AND s.status = 'active' AND t.batch_id = ANY($2::int[])
         ORDER BY t.test_date, t.id`,
        [data.month, scopeBatchIds],
      );
    } else {
      tests = await pool.query(
        `SELECT t.id AS "testId", t.title, t.subject, t.total_marks::float AS "totalMarks",
                to_char(t.test_date, 'YYYY-MM-DD') AS date, s.id AS "studentId", tr.marks_obtained::float AS "marks"
         FROM tests t
         JOIN test_results tr ON tr.test_id = t.id
         JOIN students     s  ON s.id = tr.student_id
         WHERE t.test_date IS NOT NULL AND to_char(t.test_date, 'YYYY-MM') = $1
           AND s.status = 'active'
         ORDER BY t.test_date, t.id`,
        [data.month],
      );
    }

    // Group results per student
    const byStudent = new Map<number, pdfService.AnalyticsTestResult[]>();
    for (const r of tests.rows) {
      const sid = Number(r.studentId);
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      const pct = r.totalMarks > 0 ? (r.marks / r.totalMarks) * 100 : 0;
      const day = parseInt(r.date.split('-')[2], 10);
      const week = Math.min(Math.floor((day - 1) / 7) + 1, 4);
      byStudent.get(sid)!.push({
        date:          r.date,
        week,
        subject:       r.subject,
        title:         r.title,
        marksObtained: r.marks,
        totalMarks:    r.totalMarks,
        percentage:    Math.round(pct * 10) / 10,
      });
    }

    // Build summaries
    const scopeLabel = data.batchId
      ? (rosterRows[0]?.batchName ?? `Batch #${data.batchId}`)
      : scopeBatchIds?.length === 1
        ? (rosterRows[0]?.batchName ?? 'Batch')
        : 'All Batches';

    const details: pdfService.AnalyticsStudentDetail[] = rosterRows
      .filter((r) => byStudent.has(Number(r.id)) || data.studentId)
      .map((r) => buildDetail(Number(r.id), r.studentName, r.rollNumber, Number(r.batchId), r.batchName, byStudent.get(Number(r.id)) ?? []));

    if (!details.length) {
      throw createError('No test results recorded for this month', 404);
    }

    // Rank within scope by overall percentage (only among those with results)
    const ranked = [...details].sort((a, b) => b.overallPercentage - a.overallPercentage);
    const rankMap = new Map<number, number>();
    ranked.forEach((s, i) => rankMap.set(s.studentId, i + 1));
    for (const s of details) s.rank = rankMap.get(s.studentId) ?? details.length;

    if (data.studentId) {
      const student = details[0];
      const pdf = await pdfService.generateStudentAnalyticsPdf({ ...student, month: data.month, scopeLabel });
      await uploadAnalytics(res, pdf, `analytics/student/${data.studentId}/${data.month}`, student.studentName);
      return;
    }

    const pdf = await pdfService.generateMonthlyAnalyticsPdf({
      month:       data.month,
      scopeLabel,
      students:    details,
    });
    await uploadAnalytics(res, pdf, `analytics/monthly/${data.batchId ?? 'all'}/${data.month}`, `analytics-${data.month}`);
  } catch (err) {
    next(err);
  }
}

function buildDetail(
  studentId: number,
  studentName: string,
  rollNumber: string,
  batchId: number,
  batchName: string,
  results: pdfService.AnalyticsTestResult[],
): pdfService.AnalyticsStudentDetail {
  const weekAverages: (number | null)[] = [null, null, null, null];
  for (let w = 1; w <= 4; w++) {
    const wk = results.filter((r) => r.week === w);
    if (wk.length) weekAverages[w - 1] = Math.round((wk.reduce((s, r) => s + r.percentage, 0) / wk.length) * 10) / 10;
  }

  const overall = results.length
    ? results.reduce((s, r) => s + (r.marksObtained / r.totalMarks) * 100, 0) / results.length
    : 0;

  const subjMap = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    const key = r.subject.trim().toLowerCase();
    const cur = subjMap.get(key) ?? { sum: 0, count: 0 };
    cur.sum += r.percentage;
    cur.count += 1;
    subjMap.set(key, cur);
  }
  const subjectAverages: pdfService.AnalyticsSubjectAverage[] = [...subjMap.entries()]
    .map(([k, v]) => ({ subject: results.find((r) => r.subject.trim().toLowerCase() === k)!.subject, count: v.count, percentage: Math.round((v.sum / v.count) * 10) / 10 }))
    .sort((a, b) => b.percentage - a.percentage);

  const bestSubject  = subjectAverages[0]?.subject ?? '';
  const weakSubject  = subjectAverages.length > 1 ? subjectAverages[subjectAverages.length - 1].subject : subjectAverages[0]?.subject ?? '';

  const grand = results.filter((r) => /grand/i.test(r.title)).slice(-1)[0];

  return {
    studentId,
    studentName,
    rollNumber,
    batchId,
    batchName,
    rank: 0,
    testsAppeared: results.length,
    overallPercentage: Math.round(overall * 10) / 10,
    weekAverages,
    bestSubject,
    weakSubject,
    grandTestPercentage: grand ? grand.percentage : null,
    results,
    subjectAverages,
  };
}

async function uploadAnalytics(
  res: Response,
  buffer: Buffer,
  basePath: string,
  label: string,
): Promise<void> {
  const isHtmlFallback = buffer.toString('utf-8', 0, 15).includes('<!DOCTYPE');
  const filePath = `${basePath}.${isHtmlFallback ? 'html' : 'pdf'}`;
  try {
    const url = await storageService.uploadFile(buffer, filePath, isHtmlFallback ? 'text/html' : 'application/pdf');
    const signed = await storageService.resolveDownloadUrl(url, 3600);
    res.json({
      success: true,
      data: {
        url: signed,
        ...(isHtmlFallback && { format: 'html', note: 'PDF rendering unavailable; HTML document provided. You can print to PDF from your browser.' }),
      },
    });
  } catch (err) {
    console.error('Storage upload failed, falling back to direct response:', (err as Error).message);
    const dataUrl = `data:${isHtmlFallback ? 'text/html' : 'application/pdf'};base64,${buffer.toString('base64')}`;
    res.json({
      success: true,
      data: {
        url: dataUrl,
        format: isHtmlFallback ? 'html' : 'pdf',
        ...(isHtmlFallback && { note: 'PDF rendering unavailable; HTML document provided.' }),
      },
    });
  }
}