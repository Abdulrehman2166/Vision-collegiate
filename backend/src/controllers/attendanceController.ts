import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import * as pdfService from '../services/pdfService';
import * as storageService from '../services/storageService';
import * as whatsappService from '../services/whatsappService';
import { assertBatchAccess, assertStudentAccess, scopedBatchIds } from '../utils/access';
import { getAdminWhatsapp } from '../services/settingsService';

const markSchema = z.object({
  batchId: z.number().int().positive().optional(),
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
    const ids = data.records.map((r) => r.studentId);

    // Resolve batchId per student when "all students" is used (batchId omitted)
    if (data.batchId) {
      await assertBatchAccess(req.user!, data.batchId);
      const belong = await pool.query(
        `SELECT id FROM students WHERE batch_id = $1 AND id = ANY($2::int[])`,
        [data.batchId, ids],
      );
      if (belong.rows.length !== ids.length) {
        throw createError('One or more students do not belong to this batch', 400);
      }
    }

    const studentBatches = await pool.query(
      `SELECT id, batch_id FROM students WHERE id = ANY($1::int[])`,
      [ids],
    );
    if (studentBatches.rows.length !== ids.length) {
      throw createError('One or more students do not exist', 400);
    }

    await client.query('BEGIN');

    // Upsert each record within a transaction
    const inserted: unknown[] = [];
    let skipped = 0;
    for (const rec of data.records) {
      const row = studentBatches.rows.find((r) => r.id === rec.studentId)!;
      const batchForRecord = data.batchId ?? row.batch_id;
      if (batchForRecord == null) {
        skipped++;
        continue;
      }
      const r = await client.query(
        `INSERT INTO attendance (student_id, batch_id, date, status, marked_by, note)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (student_id, date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by,
                       note = EXCLUDED.note
         RETURNING *`,
        [rec.studentId, batchForRecord, data.date, rec.status, markedBy, rec.note ?? null],
      );
      inserted.push(r.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: inserted, count: inserted.length, skipped });
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
    await assertBatchAccess(req.user!, Number(batchId));
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

/** GET /api/v1/attendance/all  ?date=YYYY-MM-DD  – attendance for all students/batches on a date */
export async function getAttendanceByDate(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw createError('Query param `date` (YYYY-MM-DD) is required', 400);
    }

    const result = await pool.query(
      `SELECT a.*, s.name AS student_name, s.roll_number, b.id AS batch_id, b.name AS batch_name
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN batches b ON b.id = a.batch_id
       WHERE a.date = $1
       ORDER BY s.roll_number, s.name`,
      [date],
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
    await assertStudentAccess(req.user!, Number(studentId));
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
export async function generateAttendancePDF(req: Request, res: Response, _next: NextFunction) {
  try {
    const schema = z.object({
      type:    z.enum(['daily_slip', 'range_slip', 'monthly_report', 'monthly_card']),
      batchId: z.number().int().positive().optional(),            // omitted = all students
      date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)').optional(),   // daily_slip
      from:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid from format (expected YYYY-MM-DD)').optional(),    // range_slip
      to:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid to format (expected YYYY-MM-DD)').optional(),      // range_slip
      month:   z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (expected YYYY-MM)').optional(),          // monthly_report / monthly_card
      studentId: z.number().int().positive().optional(), // for monthly_card of a single student
    });

    const data = schema.parse(req.body);
    if (data.batchId) await assertBatchAccess(req.user!, data.batchId);
    if (data.studentId) await assertStudentAccess(req.user!, data.studentId);

    let pdfBuffer: Buffer;
    let filePath: string;

    // Shared helper: scope for "all students" queries (teachers limited to their batches)
    const buildScope = async (): Promise<string> => {
      if (data.batchId) return 'AND a.batch_id = $2';
      const allowed = await scopedBatchIds(req.user!);
      if (req.user!.role === 'teacher' && !allowed?.length) {
        throw createError('No batches assigned to you', 403);
      }
      return allowed?.length ? 'AND a.batch_id = ANY($2::int[])' : '';
    };

    if (data.type === 'daily_slip') {
      if (!data.date) throw createError('`date` is required for daily_slip', 400);

      let rows;
      if (data.batchId) {
        const r = await pool.query(
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
        rows = r;
      } else {
        const scope = await buildScope();
        const params: unknown[] = scope ? [data.date, await scopedBatchIds(req.user!)] : [data.date];
        const r = await pool.query(
          `SELECT s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                  a.status, a.date::text AS date,
                  b.name AS "batchName"
           FROM attendance a
           JOIN students s ON s.id = a.student_id
           JOIN batches  b ON b.id = a.batch_id
           WHERE a.date = $1 ${scope}
           ORDER BY s.roll_number, s.name`,
          params,
        );
        rows = r;
      }
      if (!rows.rows.length) throw createError('No attendance records found for this date', 404);

      pdfBuffer = await pdfService.generateAttendanceSlipPdf(rows.rows as pdfService.AttendanceRecord[]);
      const isHtmlFallback = pdfBuffer.toString('utf-8', 0, 15).includes('<!DOCTYPE');
      filePath  = isHtmlFallback
        ? `attendance/slips/${data.batchId ?? 'all'}/${data.date}.html`
        : `attendance/slips/${data.batchId ?? 'all'}/${data.date}.pdf`;

    } else if (data.type === 'range_slip') {
      if (!data.from || !data.to) throw createError('`from` and `to` (YYYY-MM-DD) are required for range_slip', 400);
      if (data.from > data.to) throw createError('`from` must be on or before `to`', 400);

      let rows;
      if (data.batchId) {
        const r = await pool.query(
          `SELECT s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                  a.status, a.date::text AS date,
                  b.name AS "batchName"
           FROM students s
           JOIN batches  b ON b.id = s.batch_id
           LEFT JOIN attendance a ON a.student_id = s.id AND a.batch_id = $1 AND a.date BETWEEN $2 AND $3
           WHERE s.batch_id = $1 AND s.status = 'active'
           ORDER BY s.roll_number, s.name, a.date`,
          [data.batchId, data.from, data.to],
        );
        rows = r;
      } else {
        const allowed = await scopedBatchIds(req.user!);
        if (req.user!.role === 'teacher' && !allowed?.length) {
          throw createError('No batches assigned to you', 403);
        }
        const scope   = allowed?.length ? 'AND s.batch_id = ANY($3::int[])' : '';
        const params: unknown[] = allowed?.length ? [data.from, data.to, allowed] : [data.from, data.to];
        const r = await pool.query(
          `SELECT s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                  a.status, a.date::text AS date,
                  b.name AS "batchName"
           FROM students s
           JOIN batches  b ON b.id = s.batch_id
           LEFT JOIN attendance a ON a.student_id = s.id AND a.date BETWEEN $1 AND $2
           WHERE s.status = 'active' ${scope}
           ORDER BY s.roll_number, s.name, a.date`,
          params,
        );
        rows = r;
      }
      if (!rows.rows.length) throw createError('No active students found for this range', 404);

      const students = new Map<string, pdfService.RangeSlipStudent>();
      for (const r of rows.rows) {
        const key = `${r.rollNumber}::${r.studentName}::${r.batchName}`;
        if (!students.has(key)) {
          students.set(key, { studentName: r.studentName, rollNumber: r.rollNumber, batchName: r.batchName, days: {} });
        }
        if (r.date) students.get(key)!.days[r.date as string] = r.status as string;
      }

      pdfBuffer = await pdfService.generateRangeSlipPdf({
        from: data.from,
        to: data.to,
        students: [...students.values()],
      });
      const isHtmlFallback = pdfBuffer.toString('utf-8', 0, 15).includes('<!DOCTYPE');
      filePath  = isHtmlFallback
        ? `attendance/range/${data.batchId ?? 'all'}/${data.from}_${data.to}.html`
        : `attendance/range/${data.batchId ?? 'all'}/${data.from}_${data.to}.pdf`;

    } else if (data.type === 'monthly_report') {
      if (!data.month) throw createError('`month` (YYYY-MM) is required for monthly_report', 400);

      let rows;
      if (data.batchId) {
        const r = await pool.query(
          `SELECT s.id, s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                  b.name AS "batchName",
                  COUNT(*) FILTER (WHERE a.status = 'present') AS present,
                  COUNT(*) FILTER (WHERE a.status = 'late')    AS late,
                  COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
                  COUNT(*) FILTER (WHERE a.status = 'holiday') AS holiday,
                  COUNT(*) AS "totalDays"
           FROM attendance a
           JOIN students s ON s.id = a.student_id
           JOIN batches  b ON b.id = a.batch_id
           WHERE a.batch_id = $1 AND a.date::text LIKE $2
           GROUP BY s.id, s.name, s.roll_number, b.name
           ORDER BY s.roll_number, s.name`,
          [data.batchId, `${data.month}%`],
        );
        rows = r;
      } else {
        const scope = await buildScope();
        const allowed = await scopedBatchIds(req.user!);
        const params: unknown[] = scope ? [`${data.month}%`, allowed] : [`${data.month}%`];
        const r = await pool.query(
          `SELECT s.id, s.name AS "studentName", COALESCE(s.roll_number,'') AS "rollNumber",
                  b.name AS "batchName",
                  COUNT(*) FILTER (WHERE a.status = 'present') AS present,
                  COUNT(*) FILTER (WHERE a.status = 'late')    AS late,
                  COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
                  COUNT(*) FILTER (WHERE a.status = 'holiday') AS holiday,
                  COUNT(*) AS "totalDays"
           FROM attendance a
           JOIN students s ON s.id = a.student_id
           JOIN batches  b ON b.id = a.batch_id
           WHERE a.date::text LIKE $1 ${scope}
           GROUP BY s.id, s.name, s.roll_number, b.name
           ORDER BY s.roll_number, s.name`,
          params,
        );
        rows = r;
      }
      if (!rows.rows.length) throw createError('No attendance records found for this month', 404);

      const reportRows: pdfService.MonthlyReportRow[] = rows.rows.map((r) => {
        const totalDays  = Number(r.totalDays) || 0;
        const present    = Number(r.present)   || 0;
        const late       = Number(r.late)      || 0;
        const percentage = totalDays ? Math.round(((present + late) / totalDays) * 100) : 0;
        return {
          studentId:   Number(r.id),
          studentName: r.studentName,
          rollNumber:  r.rollNumber,
          batchName:   r.batchName,
          present,
          late,
          absent:      Number(r.absent)   || 0,
          holiday:     Number(r.holiday)  || 0,
          totalDays,
          percentage,
        };
      });

      pdfBuffer = await pdfService.generateMonthlyReportPdf({ month: data.month, rows: reportRows });
      const isHtmlFallback = pdfBuffer.toString('utf-8', 0, 15).includes('<!DOCTYPE');
      filePath  = isHtmlFallback
        ? `attendance/monthlyreports/${data.batchId ?? 'all'}/${data.month}.html`
        : `attendance/monthlyreports/${data.batchId ?? 'all'}/${data.month}.pdf`;

    } else {
      // monthly_card
      if (!data.month) throw createError('`month` (YYYY-MM) is required for monthly_card', 400);
      if (!data.batchId) throw createError('`batchId` is required for monthly_card', 400);

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

      if (data.studentId) {
        const student   = rows.rows[0];
        const records   = rows.rows.map((r) => ({ date: r.date, status: r.status }));
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
      } else {
        const studentIds = [...new Set<number>(rows.rows.map((r: { id: number }) => r.id as number))];
        const firstId = studentIds[0];
        const firstRows = rows.rows.filter((r) => r.id === firstId);
        const records   = firstRows.map((r) => ({ date: r.date, status: r.status }));
        const presentDays = records.filter((r) => ['present', 'late'].includes(r.status)).length;

        pdfBuffer = await pdfService.generateMonthlyCardPdf({
          studentName:  firstRows[0].studentName,
          rollNumber:   firstRows[0].rollNumber,
          batchName:    firstRows[0].batchName,
          month:        data.month,
          records,
          totalDays:    records.length,
          presentDays,
        });
        filePath = `attendance/monthly/${data.batchId}/${data.month}-${firstId}.pdf`;

        const uploadResult = await tryUpload(pdfBuffer, filePath);
        if (uploadResult) {
          return res.json({
            success: true,
            data: {
              url: uploadResult,
              note: `Generated for student #${firstId}. Pass \`studentId\` to generate for a specific student. Total students in batch for this month: ${studentIds.length}.`,
              totalStudents: studentIds.length,
              studentIds,
            },
          });
        }
        return sendBufferDirectly(res, pdfBuffer, 'attendance-monthly-card.html');
      }
    }

    const uploadResult = await tryUpload(pdfBuffer, filePath);
    if (uploadResult) {
      const isHtml = filePath.endsWith('.html');
      return res.json({
        success: true,
        data: {
          url: uploadResult,
          ...(isHtml && { format: 'html', note: 'PDF rendering unavailable; HTML document provided. You can print to PDF from your browser.' }),
        },
      });
    }

    return sendBufferDirectly(res, pdfBuffer, filePath.endsWith('.html') ? 'attendance.html' : 'attendance.pdf');
  } catch (error) {
    console.error('PDF Generation Backend Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors:  error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    const statusCode = (error as any).statusCode ?? 500;
    const message = statusCode === 500 ? 'PDF generation failed' : (error as Error).message;
    res.status(statusCode).json({ success: false, message });
  }
}

async function tryUpload(buffer: Buffer, filePath: string): Promise<string | null> {
  try {
    const isHtml = filePath.endsWith('.html');
    const publicUrl = await storageService.uploadFile(buffer, filePath, isHtml ? 'text/html' : 'application/pdf');
    return await storageService.resolveDownloadUrl(publicUrl, 3600);
  } catch (err) {
    console.error('Storage upload failed, falling back to direct response:', (err as Error).message);
    return null;
  }
}

function sendBufferDirectly(res: Response, buffer: Buffer, filename: string) {
  const isHtml = filename.endsWith('.html');
  const mimeType = isHtml ? 'text/html' : 'application/pdf';
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  res.json({
    success: true,
    data: {
      url: dataUrl,
      format: isHtml ? 'html' : 'pdf',
      note: isHtml ? 'PDF rendering unavailable; HTML document provided. You can print to PDF from your browser.' : undefined,
    },
  });
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
    await assertBatchAccess(req.user!, data.batchId);
    storageService.assertAllowedDocumentUrl(data.documentUrl);
    const documentUrl = await storageService.resolveDownloadUrl(data.documentUrl, 3600);

    // All active students in the batch – those without a parent phone go to the admin number
    const studentsRes = await pool.query(
      `SELECT s.id, s.name, s.parent_phone, s.parent_name
       FROM students s
       WHERE s.batch_id = $1 AND s.status = 'active'`,
      [data.batchId],
    );

    const adminWhatsapp = await getAdminWhatsapp();

    const recipients = studentsRes.rows.map((s) => ({
      phone: s.parent_phone as string,
      name:  s.parent_name  as string,
    }));
    const noContact = studentsRes.rows.filter((s) => !s.parent_phone);
    if (noContact.length) {
      recipients.push({
        phone: adminWhatsapp,
        name:  'Admin',
      });
    }

    if (!recipients.length) {
      throw createError('No students found in this batch', 404);
    }

    const caption =
      data.messageType === 'daily_slip'
        ? `Attendance slip for ${data.date} – Vision Collegiate`
        : `Monthly attendance card – Vision Collegiate`;

    const results = await whatsappService.sendDocumentBulk(
      recipients,
      documentUrl,
      caption,
      'attendance.pdf',
      data.messageType,
    );

    const sent   = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      data: {
        sent,
        failed,
        results,
        noContactStudents: noContact.map((s) => ({ id: s.id, name: s.name })),
        adminFallbackUsed: noContact.length > 0,
      },
    });
  } catch (err) {
    next(err);
  }
}
