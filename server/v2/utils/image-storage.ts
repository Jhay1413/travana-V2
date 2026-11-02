import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { randomUUID } from "crypto";
import { s3Client, S3_BUCKET } from "../config/s3";
import { AppError } from "./error-handler";

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

/**
 * The image mime types this storage layer knows how to key (kept in sync
 * with MIME_EXT above). Exported so validators (e.g. the quote images presign
 * endpoint) can restrict `contentType` to the same allowlist instead of
 * re-declaring it.
 */
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Build the stable proxy URL stored in the DB for an S3 object key. */
export function buildImageProxyUrl(key: string): string {
  return `${PROXY_PREFIX}${encodeURIComponent(key)}`;
}

/**
 * The S3 key prefixes of deal galleries (every caller of uploadImageToS3 / uploadBufferToS3 on a deal):
 * quote and booking galleries, hub post images, and the image upscaler's source copies and results
 * (quote-bound "social-upscale" and standalone "image-upscale"). Only these may be stored on a deal image
 * list and deleted through a deal image endpoint.
 */
export const DEAL_IMAGE_KEY_PREFIXES = ["quote-images/", "booking-images/", "hub-images/", "social-upscale/", "image-upscale/"] as const;

/**
 * Every S3 key prefix the app serves through the proxy (`/api/v2/files/img?key=`): the deal image prefixes,
 * tour operator logos, and training assets, thumbnails and videos (played through the same proxy, see
 * training-upload.service.ts). Anything else in the bucket (client files, HR documents, note and ticket
 * attachments, invoices) is private and must never be served by the image proxy.
 */
export const PUBLIC_IMAGE_KEY_PREFIXES = [
  ...DEAL_IMAGE_KEY_PREFIXES,
  "tour-operator-logos/",
  "training-assets/",
  "training-thumbnails/",
  "training-videos/",
] as const;

function isPlainObjectKey(key: unknown): key is string {
  if (typeof key !== "string" || key.length === 0 || key.length > 1024) return false;
  return !(key.includes("..") || key.includes("\\") || key.startsWith("/"));
}

function keyHasAnyPrefix(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix) && key.length > prefix.length);
}

/** True when `key` is a plain object key under one of the public (servable) prefixes. */
export function isPublicImageKey(key: unknown): key is string {
  return isPlainObjectKey(key) && keyHasAnyPrefix(key, PUBLIC_IMAGE_KEY_PREFIXES);
}

/**
 * If `storedUrl` is one of our S3-backed proxy URLs, return its S3 key (any prefix); else null. There is no
 * allow-list here: owners of their own prefixes (logo replace, training cleanup) use this so their objects are
 * found. Callers that must stay inside the deal image prefixes use `dealImageKeyFromStoredUrl` or
 * `deleteImageByStoredUrl`.
 */
export function s3KeyFromStoredUrl(storedUrl: string): string | null {
  if (!storedUrl?.startsWith(PROXY_PREFIX)) return null;
  let key: string;
  try {
    key = decodeURIComponent(storedUrl.slice(PROXY_PREFIX.length));
  } catch {
    return null;
  }
  return isPlainObjectKey(key) ? key : null;
}

/** True when the string is one of our image-proxy URLs (whatever key it points at). */
export function isStoredProxyUrl(url: string): boolean {
  return typeof url === "string" && url.startsWith(PROXY_PREFIX);
}

/** Like `s3KeyFromStoredUrl`, but only for keys under the public (servable) prefixes. */
export function publicImageKeyFromStoredUrl(storedUrl: string): string | null {
  const key = s3KeyFromStoredUrl(storedUrl);
  return key !== null && isPublicImageKey(key) ? key : null;
}

/** Like `s3KeyFromStoredUrl`, but only for keys under the deal image prefixes. */
export function dealImageKeyFromStoredUrl(storedUrl: string): string | null {
  const key = s3KeyFromStoredUrl(storedUrl);
  return key !== null && keyHasAnyPrefix(key, DEAL_IMAGE_KEY_PREFIXES) ? key : null;
}

/**
 * Whether an image string submitted on a quote or booking is acceptable: an inline image, one of the
 * app's own uploads or avatars, the app's own image proxy URL for a public image key, or a plain
 * http(s) URL (scraped and library images are external). Anything else (a proxy URL pointing at a
 * private key, javascript:, file:, ...) is refused.
 */
export function isAcceptableImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith(PROXY_PREFIX)) return dealImageKeyFromStoredUrl(url) !== null;
  if (url.startsWith("data:image/")) return true;
  if (url.startsWith("/uploads/") || url.startsWith("/avatars/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Build a fresh, unpredictable S3 key under `keyPrefix/` for a file, keeping
 * its extension (falling back to the mimetype's extension when the filename
 * has none). Shared by the server-side buffered upload below and by any
 * presign-for-direct-PUT flow (e.g. quote images) — the client must never
 * choose the key itself, so both paths generate it here.
 */
export function buildImageKey(keyPrefix: string, filename: string, mimetype: string): string {
  const ext = path.extname(filename) || MIME_EXT[mimetype] || "";
  return `${keyPrefix}/${Date.now()}-${randomUUID()}${ext}`;
}

/** Upload one file to S3 under `keyPrefix/` and return the stable proxy URL. */
export async function uploadImageToS3(
  file: Express.Multer.File,
  keyPrefix: string,
): Promise<string> {
  const key = buildImageKey(keyPrefix, file.originalname, file.mimetype);

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

/**
 * Removal of the S3 object behind a stored proxy URL (no-op for legacy/base64 urls). Only keys under
 * `allowedPrefixes` are deleted (default: the deal image prefixes, so a deal image endpoint can never delete a
 * logo or training file); owners of other prefixes pass their own, e.g. ["tour-operator-logos/"].
 */
export async function deleteImageByStoredUrl(
  storedUrl: string | null | undefined,
  allowedPrefixes: readonly string[] = DEAL_IMAGE_KEY_PREFIXES,
): Promise<void> {
  if (!storedUrl) return;
  const key = s3KeyFromStoredUrl(storedUrl);
  if (!key || !keyHasAnyPrefix(key, allowedPrefixes)) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

/** Upload an in-memory buffer (e.g. a server-generated image) under `keyPrefix/` and return the stable proxy URL. */
export async function uploadBufferToS3(
  buffer: Buffer,
  contentType: string,
  keyPrefix: string,
): Promise<string> {
  const key = buildImageKey(keyPrefix, "", contentType);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return buildImageProxyUrl(key);
}

/** Trim, drop blanks and duplicates, and refuse (400) any image string that is not acceptable. */
export function normalizeAcceptableImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const urls = images
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0)
    .filter((url, index, arr) => arr.indexOf(url) === index);
  if (!urls.every((url) => isAcceptableImageUrl(url))) {
    throw new AppError("Images must be uploaded images or http(s) links", 400);
  }
  return urls;
}

/** What a dropped, non-string gallery entry (null, a number, an object) is reported as. */
export const UNUSABLE_IMAGE_LABEL = "(not an image link)";

export interface ImageUrlPartition {
  /** Trimmed, de-duplicated, acceptable strings in their original order. */
  accepted: string[];
  /** Entries that were refused: the string itself, or UNUSABLE_IMAGE_LABEL for a non-string. */
  dropped: string[];
}

/**
 * Lenient twin of normalizeAcceptableImageUrls: instead of refusing the whole list when one entry is bad, keep the
 * acceptable strings and report the rest. The security rule is unchanged because it is the same predicate: a proxy
 * URL for a non-public key, javascript:, protocol-relative and bare-host values are all dropped, never stored or
 * presigned. Blank strings and duplicates vanish silently (nothing was lost).
 */
export function partitionAcceptableImageUrls(images: unknown): ImageUrlPartition {
  const accepted: string[] = [];
  const dropped: string[] = [];
  if (!Array.isArray(images)) return { accepted, dropped };
  for (const entry of images) {
    if (typeof entry !== "string") {
      dropped.push(UNUSABLE_IMAGE_LABEL);
      continue;
    }
    const url = entry.trim();
    if (!url) continue;
    if (!isAcceptableImageUrl(url)) {
      if (!dropped.includes(url)) dropped.push(url);
    } else if (!accepted.includes(url)) {
      accepted.push(url);
    }
  }
  return { accepted, dropped };
}
