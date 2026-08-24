import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';
import * as whatsappService from '../services/whatsappService';
import { logger } from '../utils/logger';

/** POST /api/v1/whatsapp/send-document  – generic document send */
export async function sendDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      to:          z.string().min(7),
      documentUrl: z.string().url(),
      caption:     z.string().optional(),
      filename:    z.string().optional(),
    });
    const data = schema.parse(req.body);

    const messageId = await whatsappService.sendDocument({
      toPhone:     data.to,
      documentUrl: data.documentUrl,
      caption:     data.caption,
      filename:    data.filename,
      messageType: 'manual',
    });

    res.json({ success: true, data: { messageId } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/whatsapp/send-text */
export async function sendText(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      to:      z.string().min(7),
      message: z.string().min(1),
    });
    const data = schema.parse(req.body);

    const messageId = await whatsappService.sendTextMessage(data.to, data.message);
    res.json({ success: true, data: { messageId } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/whatsapp/logs */
export async function getLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const params: (string | number)[] = [];
    let where = '';
    if (status) {
      where = 'WHERE status = $1';
      params.push(status);
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM whatsapp_logs ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const p = params.length;
    const dataRes = await pool.query(
      `SELECT * FROM whatsapp_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${p - 1} OFFSET $${p}`,
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

/** POST /api/v1/whatsapp/webhook  – Meta delivery status callback */
export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    // ── HMAC-SHA256 signature verification ──────────────────────────
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (signature) {
      // rawBody is attached by express.raw() middleware in the route
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (rawBody) {
        const valid = whatsappService.verifyWebhookSignature(rawBody, signature);
        if (!valid) {
          logger.warn('WhatsApp webhook: invalid signature — request rejected');
          res.sendStatus(403);
          return;
        }
      }
    } else if (process.env.WHATSAPP_APP_SECRET) {
      // Secret is configured but no signature header — reject
      logger.warn('WhatsApp webhook: missing X-Hub-Signature-256 header — request rejected');
      res.sendStatus(403);
      return;
    }

    // Respond with 200 immediately to acknowledge receipt
    res.sendStatus(200);

    const body = req.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{ id: string; status: string }>;
          };
        }>;
      }>;
    };

    const statuses = body?.entry?.[0]?.changes?.[0]?.value?.statuses ?? [];
    for (const s of statuses) {
      await pool.query(
        `UPDATE whatsapp_logs SET status = $1, updated_at = now() WHERE message_id = $2`,
        [s.status, s.id],
      );
    }
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/whatsapp/webhook  – Meta verification challenge */
export function verifyWebhook(req: Request, res: Response): void {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

/** GET /api/v1/whatsapp/logs/:id */
export async function getLogById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query('SELECT * FROM whatsapp_logs WHERE id = $1', [req.params.id]);
    if (!result.rows.length) throw createError('Log not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
