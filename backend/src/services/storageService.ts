/**
 * storageService – abstracts file storage.
 * Currently uses Supabase Storage.
 * Swap the implementation here if you move to S3.
 */
import axios from 'axios';
import { logger } from '../utils/logger';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const BUCKET = process.env.STORAGE_BUCKET ?? 'reports';

// New-format Supabase keys (sb_secret_*) are accepted via the `apikey` header,
// while legacy JWT service-role keys (eyJ...) use `Authorization: Bearer`.
// Send both so either key format works.
function storageHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
}

function normalizeStoragePath(filePath: string): string {
  return filePath.trim().replace(/^\/+/, '');
}

/**
 * Validate that a document URL belongs to the configured Supabase bucket.
 */
export function assertAllowedDocumentUrl(url: string): void {
  if (!url) throw new Error('Document URL is required');
  if (!SUPABASE_URL) return;

  const allowedPrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(allowedPrefix)) {
    throw new Error('Document URL is not from the configured storage bucket');
  }
}

/**
 * Generate a signed download URL when the backend is configured with Supabase service credentials.
 * If no signed URL can be generated, return the public URL as a safe fallback.
 */
export async function resolveDownloadUrl(fileUrl: string, expiresInSeconds = 3600): Promise<string> {
  if (!fileUrl) return fileUrl;
  if (!SUPABASE_URL) return fileUrl;

  if (!SUPABASE_SERVICE_KEY) return fileUrl;

  try {
    const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    const objectPrefix = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/`;
    const relativePath = fileUrl.startsWith(publicPrefix)
      ? fileUrl.slice(publicPrefix.length)
      : fileUrl.split(objectPrefix)[1];
    if (!relativePath) return fileUrl;

    const signUrl = `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${normalizeStoragePath(relativePath)}`;
    const response = await axios.post(
      signUrl,
      { expiresIn: expiresInSeconds },
      {
        headers: {
          ...storageHeaders(),
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data?.signedUrl ?? response.data?.url ?? fileUrl;
  } catch (err) {
    logger.warn(`Unable to resolve signed storage URL: ${(err as Error).message}`);
    return fileUrl;
  }
}

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

  const normalizedPath = normalizeStoragePath(filePath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${normalizedPath}`;

  await axios.post(url, buffer, {
    headers: {
      ...storageHeaders(),
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
  });

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${normalizedPath}`;
  logger.info(`Uploaded file to storage: ${publicUrl}`);
  return publicUrl;
}

/**
 * Delete a file from storage (used during cleanup).
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const normalizedPath = normalizeStoragePath(filePath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${normalizedPath}`;
  await axios.delete(url, {
    headers: storageHeaders(),
  });
  logger.info(`Deleted file from storage: ${filePath}`);
}
