/**
 * scheduler.ts
 * 1. Keep-alive ping every 10 minutes so Railway free tier never sleeps.
 * 2. Cron job for scheduled WhatsApp dispatch of test papers.
 */
import cron from 'node-cron';
import { pool } from './db';
import * as whatsappService from './services/whatsappService';
import { logger } from './utils/logger';

// ─── Keep-alive: ping own /health every 10 min ────────────────────────────────
function startKeepAlive(): void {
  const selfUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`
    : process.env.SELF_URL
      ? `${process.env.SELF_URL}/health`
      : null;

  if (!selfUrl) {
    logger.info('Keep-alive disabled (set RAILWAY_PUBLIC_DOMAIN or SELF_URL env var to enable)');
    return;
  }

  // Ping every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const res = await fetch(selfUrl);
      if (res.ok) logger.info('Keep-alive ping OK');
    } catch (err) {
      logger.warn('Keep-alive ping failed:', { error: (err as Error).message });
    }
  });

  logger.info(`Keep-alive started — pinging ${selfUrl} every 10 minutes`);
}

// ─── WhatsApp test dispatch scheduler ────────────────────────────────────────
export function startScheduler(): void {
  // Always start keep-alive regardless of WhatsApp config
  startKeepAlive();

  // Skip WhatsApp scheduler if credentials not configured
  const dbUrl   = process.env.DATABASE_URL ?? '';
  const waToken = process.env.WHATSAPP_TOKEN ?? '';
  if (dbUrl.includes('[YOUR') || !waToken || waToken === 'your_whatsapp_access_token') {
    logger.info('WhatsApp scheduler disabled — configure WHATSAPP_TOKEN to enable');
    return;
  }

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString();

      const schedRes = await pool.query(
        `SELECT ts.id, ts.test_id, ts.batch_id,
                t.title, t.student_pdf_url
         FROM test_schedules ts
         JOIN tests t ON t.id = ts.test_id
         WHERE ts.dispatched = FALSE AND ts.dispatch_at <= $1`,
        [now],
      );

      if (schedRes.rows.length === 0) return;

      for (const schedule of schedRes.rows) {
        if (!schedule.student_pdf_url) {
          logger.warn(`Skipping scheduled dispatch for test ${schedule.test_id}: no student PDF`);
          continue;
        }

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
          logger.info(`Scheduled dispatch done: test ${schedule.test_id}, batch ${schedule.batch_id}`);
        }

        await pool.query('UPDATE test_schedules SET dispatched = TRUE WHERE id = $1', [schedule.id]);
      }
    } catch (err) {
      logger.error('Scheduler error:', { error: (err as Error).message });
    }
  });

  logger.info('WhatsApp dispatch scheduler started (runs every minute)');
}
