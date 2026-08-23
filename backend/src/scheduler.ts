/**
 * scheduler.ts – cron jobs for automated WhatsApp dispatch of test papers.
 * Runs every minute and checks test_schedules for pending dispatches.
 */
import cron from 'node-cron';
import { pool } from './db';
import * as whatsappService from './services/whatsappService';
import { logger } from './utils/logger';

export function startScheduler(): void {
  // Skip scheduler if critical env vars are not yet configured
  const dbUrl = process.env.DATABASE_URL ?? '';
  const waToken = process.env.WHATSAPP_TOKEN ?? '';
  if (dbUrl.includes('[YOUR') || !waToken || waToken === 'your_whatsapp_access_token') {
    logger.info('Test dispatch scheduler disabled — configure DATABASE_URL and WHATSAPP_TOKEN to enable');
    return;
  }

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString();

      // Fetch pending schedules whose dispatch time has passed
      const schedRes = await pool.query(
        `SELECT ts.id, ts.test_id, ts.batch_id,
                t.title, t.student_pdf_url
         FROM test_schedules ts
         JOIN tests t ON t.id = ts.test_id
         WHERE ts.dispatched = FALSE AND ts.dispatch_at <= $1`,
        [now],
      );

      // No pending schedules, skip silently
      if (schedRes.rows.length === 0) return;

      for (const schedule of schedRes.rows) {
        if (!schedule.student_pdf_url) {
          logger.warn(`Skipping scheduled dispatch for test ${schedule.test_id}: no student PDF`);
          continue;
        }

        // Get recipients
        const studentsRes = await pool.query(
          `SELECT s.name, s.parent_phone, s.parent_name
           FROM students s
           WHERE s.batch_id = $1 AND s.status = 'active' AND s.parent_phone IS NOT NULL`,
          [schedule.batch_id],
        );

        if (studentsRes.rows.length) {
          await whatsappService.sendDocumentBulk(
            studentsRes.rows.map((s) => ({ phone: s.parent_phone, name: s.parent_name })),
            schedule.student_pdf_url as string,
            `Test Paper: ${schedule.title} – Vision Collegiate`,
            `${schedule.title}.pdf`,
            'test_paper_scheduled',
            schedule.test_id as number,
          );
          logger.info(`Scheduled test dispatch completed: test ${schedule.test_id}, batch ${schedule.batch_id}`);
        }

        // Mark as dispatched regardless of result
        await pool.query('UPDATE test_schedules SET dispatched = TRUE WHERE id = $1', [schedule.id]);
      }
    } catch (err) {
      logger.error('Scheduler error:', { error: (err as Error).message });
    }
  });

  logger.info('Test dispatch scheduler started (runs every minute)');
}
