import { s3KeyFromStoredUrl, buildImageProxyUrl } from '../../utils/image-storage';
import { AppError } from '../../utils/error-handler';

/** Top-level S3 folders used by the training module (see training-upload.service.ts / uploadAssets). */
export const TRAINING_ASSET_PREFIX = 'training-assets';
export const TRAINING_VIDEO_PREFIX = 'training-videos';
export const TRAINING_THUMBNAIL_PREFIX = 'training-thumbnails';
export const TRAINING_STORAGE_PREFIXES: readonly string[] = [
  TRAINING_ASSET_PREFIX,
  TRAINING_VIDEO_PREFIX,
  TRAINING_THUMBNAIL_PREFIX,
];

/** S3 key behind a stored proxy URL, or null for external/legacy URLs (and malformed escapes). */
export function safeS3Key(storedUrl: string): string | null {
  try {
    return s3KeyFromStoredUrl(storedUrl);
  } catch {
    return null;
  }
}

export function keyHasPrefix(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => key.startsWith(`${p}/`));
}

/**
 * Client-supplied media URLs (asset url, lesson video, course thumbnail) may be
 * external http(s) URLs, but a URL that points at OUR S3 bucket must live under
 * the given training prefix — otherwise an author could reference (and later
 * trigger deletion of) another tenant's object. Returns the canonical form
 * (re-encoded proxy URL for S3 keys; the input unchanged for external URLs).
 */
export function normalizeTrainingUrl(url: string, prefix: string, label: string): string {
  let key: string | null;
  try {
    key = s3KeyFromStoredUrl(url);
  } catch {
    throw new AppError(`${label} is not a valid URL`, 400);
  }
  if (key === null) return url;
  if (!keyHasPrefix(key, [prefix])) {
    throw new AppError(`${label} must reference a file uploaded for training`, 400);
  }
  return buildImageProxyUrl(key);
}
