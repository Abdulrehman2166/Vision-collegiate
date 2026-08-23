/**
 * storageService – abstracts file storage.
 * Currently uses Supabase Storage.
 * Swap the implementation here if you move to S3.
 */
import axios from 'axios';
import { logger } from '../utils/logger';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const BUCKET = process.env.STORAGE_BUCKET ?? 'reports';

/**
 * Upload a Buffer to Supabase Storage.
 * @param buffer   File content
 * @param filePath Path inside the bucket, e.g. "attendance/2024-01/slip-42.pdf"
 * @param mimeType MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  buffer: Buffer,
  filePath: string,
  mimeType = 'application/pdf',
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;

  await axios.post(url, buffer, {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
  });

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
  logger.info(`Uploaded file to storage: ${publicUrl}`);
  return publicUrl;
}

/**
 * Delete a file from storage (used during cleanup).
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;
  await axios.delete(url, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  logger.info(`Deleted file from storage: ${filePath}`);
}
