import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import * as pdfService from '../services/pdfService';
import * as storageService from '../services/storageService';
import * as whatsappService from '../services/whatsappService';

const markSchema = z.object({
  batchId: z.number().int().positive(),
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(
    z.object({
      studentId: z.number().int().positive(),
      status:    z.enum(['present', 'absent', 'late', 'holiday']),
      note:      z.string().optional().nullable(),
    }),
  ).min(1),
});

/** POST /api/v1/attendance/mark */
export async function markBatchAttendance(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    const data = markSchema.parse(req.body);
    const markedBy = req.user!.id;

    await client.query('BEGIN');

    // Upsert each record within a transaction
    const inserted: unknown[] = [];
    for (const rec of data.records) {
      const r = await client.query(
        `INSERT INTO attendance (student_id, batch_id, date, status, marked_by, note)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (student_id, date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by,
                       note = EXCLUDED.note
         RETURNING *`,
        [rec.studentId, data.batchId, data.date, rec.status, markedBy, rec.note ?? null],
      );
      inserted.push(r.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: inserted, count: inserted.length });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/** GET /api/v1/attendance/batch/:batchId  ?date=YYYY-MM-DD */
export async function getBatchAttendanceByDate(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw createError('Query param `date` (YYYY-MM-DD) is required', 400);
    }

    const result = await pool.query(
      `SELECT a.*, s.name AS student_name, s.roll_number
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.batch_id = $1 AND a.date = $2
       ORDER BY s.roll_number, s.name`,
      [batchId, date],
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/attendance/student/:studentId  ?from=&to= */
export async function getStudentAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId } = req.params;
    const from = (req.query.from as string) || '1970-01-01';
    const to   = (req.query.to   as string) || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT * FROM attendance
       WHERE student_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date DESC`,
      [studentId, from, to],
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// ─── PDF reports ───────────────────────────────────────────────────────────────

/** POST /api/v1/attendance/reports/generate-pdf */
export async function generateAttendancePDF(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      type:    z.enum(['daily_slip', 'monthly_card']),
      batchId: z.number().int().positive(),
      date:    z.string().optional(),   // for daily_slip
      month:   z.string().optional(),   // "2025-01" for monthly_card
      studentId: z.number().int().positive().optional(), // for monthly_card of a single student
    });

    const data = schema.parse(req.body);

    let pdfBuffer: Buffer;
    let filePath: string;

    if (data.type === 'daily_slip') {
      if (!data.date) throw createError('`date` is required for daily_slip', 400);

      const rows = await pool.query(
        `SELECT s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                a.status, a.date::text AS date,
                b.name AS "batchName"
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN batches  b ON b.id = a.batch_id
         WHERE a.batch_id = $1 AND a.date = $2
         ORDER BY s.roll_number, s.name`,
        [data.batchId, data.date],
      );
      if (!rows.rows.length) throw createError('No attendance records found for this date', 404);

      pdfBuffer = await pdfService.generateAttendanceSlipPdf(rows.rows as pdfService.AttendanceRecord[]);
      filePath  = `attendance/slips/${data.batchId}/${data.date}.pdf`;

    } else {
      // monthly_card
      if (!data.month) throw createError('`month` (YYYY-MM) is required for monthly_card', 400);

      const studentFilter = data.studentId ? 'AND s.id = $3' : '';
      const params: (string | number)[] = [data.batchId, `${data.month}%`];
      if (data.studentId) params.push(data.studentId);

      const rows = await pool.query(
        `SELECT s.id, s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                b.name AS "batchName",
                a.date::text AS date, a.status
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN batches  b ON b.id = a.batch_id
         WHERE a.batch_id = $1 AND a.date::text LIKE $2 ${studentFilter}
         ORDER BY s.roll_number, a.date`,
        params,
      );
      if (!rows.rows.length) throw createError('No attendance records found for this month', 404);

      // Group by student and generate per-student PDF (first student or specific)
      const student = rows.rows[0];
      const records = rows.rows
        .filter((r) => r.id === student.id)
        .map((r) => ({ date: r.date, status: r.status }));

      const presentDays = records.filter((r) => ['present', 'late'].includes(r.status)).length;
      pdfBuffer = await pdfService.generateMonthlyCardPdf({
        studentName:  student.studentName,
        rollNumber:   student.rollNumber,
        batchName:    student.batchName,
        month:        data.month,
        records,
        totalDays:    records.length,
        presentDays,
      });
      filePath = `attendance/monthly/${data.batchId}/${data.month}-${student.id}.pdf`;
    }

    const publicUrl = await storageService.uploadFile(pdfBuffer, filePath);
    res.json({ success: true, data: { url: publicUrl } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/attendance/reports/send-whatsapp */
export async function sendAttendanceToParents(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      batchId:     z.number().int().positive(),
      documentUrl: z.string().url(),
      date:        z.string(),
      messageType: z.enum(['daily_slip', 'monthly_card']).default('daily_slip'),
    });

    const data = schema.parse(req.body);

    // Get all parents of students in this batch
    const studentsRes = await pool.query(
      `SELECT s.id, s.name, s.parent_phone, s.parent_name
       FROM students s
       WHERE s.batch_id = $1 AND s.status = 'active' AND s.parent_phone IS NOT NULL`,
      [data.batchId],
    );

    if (!studentsRes.rows.length) {
      throw createError('No students with parent phones found in this batch', 404);
    }

    const recipients = studentsRes.rows.map((s) => ({
      phone: s.parent_phone as string,
      name:  s.parent_name  as string,
    }));

    const caption =
      data.messageType === 'daily_slip'
        ? `Attendance slip for ${data.date} – Vision Collegiate`
        : `Monthly attendance card – Vision Collegiate`;

    const results = await whatsappService.sendDocumentBulk(
      recipients,
      data.documentUrl,
      caption,
      'attendance.pdf',
      data.messageType,
    );

    const sent   = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({ success: true, data: { sent, failed, results } });
  } catch (err) {
    next(err);
  }
}
