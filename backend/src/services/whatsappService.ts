/**
 * whatsappService – sends messages via Meta WhatsApp Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { pool } from '../db';
import { logger } from '../utils/logger';

const WA_API_VERSION = 'v19.0';
const WA_BASE = `https://graph.facebook.com/${WA_API_VERSION}`;

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN ?? ''}`,
    'Content-Type': 'application/json',
  };
}

function getPhoneId(): string {
  const id = process.env.WHATSAPP_PHONE_ID;
  if (!id) throw new Error('WHATSAPP_PHONE_ID is not set');
  return id;
}

/**
 * Normalise and validate phone number.
 * Strips formatting characters and ensures a country code is present.
 * If the number doesn't start with a country code (doesn't begin with 1-3 digits
 * matching a known country prefix), prepend the default country code from env.
 * Default country code: WHATSAPP_DEFAULT_CC (e.g. "91" for India).
 */
export function normalisePhone(phone: string): string {
  // Strip all non-digit characters
  const stripped = phone.replace(/\D/g, '');

  // If it already looks like it has a country code (≥11 digits), return as-is
  if (stripped.length >= 11) return stripped;

  // Otherwise prepend the configured default country code (default: 91 for India)
  const defaultCC = (process.env.WHATSAPP_DEFAULT_CC ?? '91').replace(/\D/g, '');
  const withCC = `${defaultCC}${stripped}`;

  logger.warn(`Phone ${phone} appears to lack a country code — prepended ${defaultCC}: ${withCC}`);
  return withCC;
}

/**
 * Verify Meta WhatsApp webhook signature.
 * Meta sends X-Hub-Signature-256: sha256=<hmac> on POST webhooks.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    logger.warn('WHATSAPP_APP_SECRET not set — skipping webhook signature verification');
    return true; // graceful degradation if not configured
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ─── Log helper ───────────────────────────────────────────────────────────────

async function logWhatsapp(params: {
  recipientPhone: string;
  recipientName?: string;
  messageId?: string;
  messageType: string;
  referenceId?: number;
  status: string;
  errorMessage?: string;
  payload?: object;
}): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_logs
       (recipient_phone, recipient_name, message_id, message_type, reference_id, status, error_message, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.recipientPhone,
      params.recipientName ?? null,
      params.messageId ?? null,
      params.messageType,
      params.referenceId ?? null,
      params.status,
      params.errorMessage ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
    ],
  );
}

// ─── Send text message ────────────────────────────────────────────────────────

export async function sendTextMessage(
  toPhone: string,
  message: string,
  recipientName?: string,
): Promise<string> {
  const phone = normalisePhone(toPhone);
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message },
  };

  try {
    const resp = await axios.post(`${WA_BASE}/${getPhoneId()}/messages`, payload, {
      headers: getHeaders(),
    });
    const messageId: string = resp.data?.messages?.[0]?.id ?? '';
    await logWhatsapp({ recipientPhone: phone, recipientName, messageId, messageType: 'text', status: 'sent', payload });
    logger.info(`WhatsApp text sent to ${phone}, messageId=${messageId}`);
    return messageId;
  } catch (err) {
    const error = err as AxiosError;
    const msg = JSON.stringify(error.response?.data ?? error.message);
    await logWhatsapp({ recipientPhone: phone, recipientName, messageType: 'text', status: 'failed', errorMessage: msg, payload });
    logger.error(`WhatsApp text failed for ${phone}: ${msg}`);
    throw err;
  }
}

// ─── Send document (PDF) via URL ──────────────────────────────────────────────

export async function sendDocument(options: {
  toPhone: string;
  documentUrl: string;
  caption?: string;
  filename?: string;
  recipientName?: string;
  messageType?: string;
  referenceId?: number;
}): Promise<string> {
  const phone = normalisePhone(options.toPhone);
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'document',
    document: {
      link: options.documentUrl,
      caption: options.caption ?? 'Vision Collegiate',
      filename: options.filename ?? 'document.pdf',
    },
  };

  const msgType = options.messageType ?? 'document';
  try {
    const resp = await axios.post(`${WA_BASE}/${getPhoneId()}/messages`, payload, {
      headers: getHeaders(),
    });
    const messageId: string = resp.data?.messages?.[0]?.id ?? '';
    await logWhatsapp({
      recipientPhone: phone,
      recipientName: options.recipientName,
      messageId,
      messageType: msgType,
      referenceId: options.referenceId,
      status: 'sent',
      payload,
    });
    logger.info(`WhatsApp document sent to ${phone}, messageId=${messageId}`);
    return messageId;
  } catch (err) {
    const error = err as AxiosError;
    const msg = JSON.stringify(error.response?.data ?? error.message);
    await logWhatsapp({
      recipientPhone: phone,
      recipientName: options.recipientName,
      messageType: msgType,
      referenceId: options.referenceId,
      status: 'failed',
      errorMessage: msg,
      payload,
    });
    logger.error(`WhatsApp document failed for ${phone}: ${msg}`);
    throw err;
  }
}

// ─── Bulk send ────────────────────────────────────────────────────────────────

export interface BulkRecipient {
  phone: string;
  name?: string;
}

/**
 * Send the same document to multiple recipients.
 * Returns per-recipient results (resolved/rejected).
 */
export async function sendDocumentBulk(
  recipients: BulkRecipient[],
  documentUrl: string,
  caption: string,
  filename: string,
  messageType: string,
  referenceId?: number,
): Promise<{ phone: string; success: boolean; messageId?: string; error?: string }[]> {
  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendDocument({
        toPhone: r.phone,
        documentUrl,
        caption,
        filename,
        recipientName: r.name,
        messageType,
        referenceId,
      }),
    ),
  );

  return results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return { phone: recipients[idx].phone, success: true, messageId: result.value };
    }
    return {
      phone: recipients[idx].phone,
      success: false,
      error: (result.reason as Error).message,
    };
  });
}
