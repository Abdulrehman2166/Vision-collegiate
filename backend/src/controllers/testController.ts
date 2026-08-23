import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import * as pdfService from '../services/pdfService';
import * as storageService from '../services/storageService';
import * as whatsappService from '../services/whatsappService';

const questionSchema = z.object({
  section:       z.string().optional().nullable(),
  question:      z.string().min(1),
  answer:        z.string().optional().nullable(),
  marks:         z.number().int().positive().default(1),
  question_type: z.enum(['mcq', 'short', 'long', 'subjective']).default('subjective'),
  options:       z.array(z.string()).optional().nullable(),
  order_index:   z.number().int().default(0),
});

const testSchema = z.object({
  title:          z.string().min(2),
  subject:        z.string().min(1),
  grade:          z.enum(['IX', 'X', 'XI', 'XII']),
  stream:         z.string().optional().nullable(),
  batch_id:       z.number().int().positive().optional().nullable(),
  total_marks:    z.number().int().positive().default(100),
  duration_mins:  z.number().int().positive().default(180),
  test_date:      z.string().optional().nullable(),
  board_pattern:  z.string().optional().nullable(),
  questions:      z.array(questionSchema).min(1),
});

/** POST /api/v1/tests/generate */
export async function generateTestPaper(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    const data = testSchema.parse(req.body);
    const createdBy = req.user!.id;

    await client.query('BEGIN');

    // Insert test
    const testRes = await client.query(
      `INSERT INTO tests (title, subject, grade, stream, batch_id, total_marks, duration_mins,
                          test_date, board_pattern, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        data.title, data.subject, data.grade, data.stream ?? null, data.batch_id ?? null,
        data.total_marks, data.duration_mins, data.test_date ?? null,
        data.board_pattern ?? null, createdBy,
      ],
    );
    const test = testRes.rows[0];

    // Insert questions
    for (const q of data.questions) {
      await client.query(
        `INSERT INTO test_questions
           (test_id, section, question, answer, marks, question_type, options, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          test.id, q.section ?? null, q.question, q.answer ?? null,
          q.marks, q.question_type,
          q.options ? JSON.stringify(q.options) : null,
          q.order_index,
        ],
      );
    }

    // Generate student PDF
    const meta: pdfService.TestPaperMeta = {
      title:        data.title,
      subject:      data.subject,
      grade:        data.grade,
      stream:       data.stream ?? undefined,
      totalMarks:   data.total_marks,
      durationMins: data.duration_mins,
      boardPattern: data.board_pattern ?? undefined,
      testDate:     data.test_date ?? undefined,
    };

    const questions: pdfService.TestQuestion[] = data.questions.map((q) => ({
      section:       q.section ?? undefined,
      question:      q.question,
      answer:        q.answer ?? undefined,
      marks:         q.marks,
      question_type: q.question_type,
      options:       q.options ?? undefined,
      order_index:   q.order_index,
    }));

    const [studentPdf, teacherPdf] = await Promise.all([
      pdfService.generateTestPaperPdf(meta, questions, false),
      pdfService.generateTestPaperPdf(meta, questions, true),
    ]);

    const [studentUrl, teacherUrl] = await Promise.all([
      storageService.uploadFile(studentPdf, `tests/${test.id}/student.pdf`),
      storageService.uploadFile(teacherPdf, `tests/${test.id}/teacher.pdf`),
    ]);

    // Save URLs back to test row
    await client.query(
      'UPDATE tests SET student_pdf_url=$1, teacher_pdf_url=$2 WHERE id=$3',
      [studentUrl, teacherUrl, test.id],
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: { ...test, student_pdf_url: studentUrl, teacher_pdf_url: teacherUrl },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/** GET /api/v1/tests */
export async function getAllTests(req: Request, res: Response, next: NextFunction) {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const grade   = req.query.grade   as string | undefined;
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;

    if (grade)   { conditions.push(`t.grade = $${p++}`);    params.push(grade); }
    if (batchId) { conditions.push(`t.batch_id = $${p++}`); params.push(batchId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM tests t ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT t.*, u.name AS created_by_name, b.name AS batch_name
       FROM tests t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN batches b ON b.id = t.batch_id
       ${where}
       ORDER BY t.created_at DESC
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

/** GET /api/v1/tests/:id */
export async function getTestById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const testRes = await pool.query(
      `SELECT t.*, u.name AS created_by_name, b.name AS batch_name
       FROM tests t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN batches b ON b.id = t.batch_id
       WHERE t.id = $1`,
      [id],
    );
    if (!testRes.rows.length) throw createError('Test not found', 404);

    const questionsRes = await pool.query(
      'SELECT * FROM test_questions WHERE test_id = $1 ORDER BY order_index',
      [id],
    );

    res.json({
      success: true,
      data: { ...testRes.rows[0], questions: questionsRes.rows },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/tests/:id/export-pdf?type=student|teacher */
export async function exportTestPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const type = (req.query.type as string) === 'teacher' ? 'teacher' : 'student';

    // Only teachers/admins can get teacher PDF
    if (type === 'teacher' && !['admin', 'teacher'].includes(req.user!.role)) {
      throw createError('Not authorized to access teacher PDF', 403);
    }

    const testRes = await pool.query('SELECT * FROM tests WHERE id = $1', [id]);
    if (!testRes.rows.length) throw createError('Test not found', 404);

    const test = testRes.rows[0];
    const url  = type === 'teacher' ? test.teacher_pdf_url : test.student_pdf_url;

    if (!url) throw createError('PDF not yet generated for this test', 404);

    res.json({ success: true, data: { url, type } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/tests/:id/dispatch-whatsapp */
export async function dispatchTestToStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const testRes = await pool.query('SELECT * FROM tests WHERE id = $1', [id]);
    if (!testRes.rows.length) throw createError('Test not found', 404);

    const test = testRes.rows[0];
    if (!test.student_pdf_url) throw createError('Student PDF not yet generated', 400);
    if (!test.batch_id)        throw createError('Test is not assigned to a batch', 400);

    const studentsRes = await pool.query(
      `SELECT s.name, s.parent_phone, s.parent_name
       FROM students s
       WHERE s.batch_id = $1 AND s.status = 'active' AND s.parent_phone IS NOT NULL`,
      [test.batch_id],
    );

    if (!studentsRes.rows.length) {
      throw createError('No students with parent phones in this batch', 404);
    }

    const recipients = studentsRes.rows.map((s) => ({
      phone: s.parent_phone as string,
      name:  s.parent_name  as string,
    }));

    const results = await whatsappService.sendDocumentBulk(
      recipients,
      test.student_pdf_url as string,
      `Test Paper: ${test.title} – Vision Collegiate`,
      `${test.title}.pdf`,
      'test_paper',
      test.id as number,
    );

    const sent   = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({ success: true, data: { sent, failed, results } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/tests/:id/schedule */
export async function scheduleTestDispatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const schema = z.object({
      batch_id:    z.number().int().positive(),
      dispatch_at: z.string(), // ISO timestamp
    });
    const data = schema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO test_schedules (test_id, batch_id, dispatch_at)
       VALUES ($1,$2,$3) RETURNING *`,
      [id, data.batch_id, data.dispatch_at],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
