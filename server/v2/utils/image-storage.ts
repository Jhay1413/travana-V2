import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { randomUUID } from "crypto";
import { s3Client, S3_BUCKET } from "../config/s3";

/**
 * Shared S3 storage for quote/booking gallery images.
 *
 * Files are streamed to S3 and the DB stores only a small, stable proxy URL
 * (`/api/v2/files/img?key=<s3key>`) instead of a multi-megabyte base64 string.
 * The proxy endpoint 302-redirects to a short-lived presigned URL, so the
 * stored value never expires and the read path can pass it straight through to
 * `<img src>` (browser, authed app pages, and same-origin public quote pages).
 */

const PROXY_PREFIX = "/api/v2/files/img?key=";
const PRESIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hour
const PRESIGNED_PUT_EXPIRES_IN = 15 * 60; // 15 minutes

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Build the stable proxy URL stored in the DB for an S3 object key. */
export function buildImageProxyUrl(key: string): string {
  return `${PROXY_PREFIX}${encodeURIComponent(key)}`;
}

/** If `storedUrl` is one of our S3-backed proxy URLs, return its S3 key; else null. */
export function s3KeyFromStoredUrl(storedUrl: string): string | null {
  if (!storedUrl?.startsWith(PROXY_PREFIX)) return null;
  return decodeURIComponent(storedUrl.slice(PROXY_PREFIX.length));
}

/** Upload one file to S3 under `keyPrefix/` and return the stable proxy URL. */
export async function uploadImageToS3(
  file: Express.Multer.File,
  keyPrefix: string,
): Promise<string> {
  const ext = path.extname(file.originalname) || MIME_EXT[file.mimetype] || "";
  const key = `${keyPrefix}/${Date.now()}-${randomUUID()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return buildImageProxyUrl(key);
}

/** Generate a short-lived presigned GET URL for an S3 key. */
export async function presignImageKey(key: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: PRESIGNED_URL_EXPIRES_IN },
  );
}

/**
 * Presigned GET for playback (training videos, etc). This is the exact same
 * presigner as `presignImageKey` (name kept for that call site's history) —
 * exported under this name too so non-image callers (e.g. training video
 * playback) don't have to import an "image" helper. Do not duplicate the
 * signing logic; keep both names pointed at one implementation.
 */
export const getPresignedGetUrl = presignImageKey;

/**
 * Generate a short-lived presigned PUT URL so a browser can upload a large
 * file (e.g. training video) directly to S3 without the file ever passing
 * through this server. Short expiry since it's only used to start one upload.
 */
export async function getPresignedPutUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: PRESIGNED_PUT_EXPIRES_IN },
  );
}

/** Best-effort removal of the S3 object behind a stored proxy URL (no-op for legacy/base64 urls). */
export async function deleteImageByStoredUrl(storedUrl: string | null | undefined): Promise<void> {
  if (!storedUrl) return;
  const key = s3KeyFromStoredUrl(storedUrl);
  if (!key) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
