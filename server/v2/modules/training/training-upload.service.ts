import { randomUUID } from 'crypto';
import { getPresignedPutUrl, buildImageProxyUrl } from '../../utils/image-storage';
import { AppError } from '../../utils/error-handler';
import type { PresignUploadInput, PresignUploadResult } from './training.types';

/**
 * Allowlisted video mime types → S3 key extension. Keeping this as a fixed
 * map (rather than trusting the client's file extension) means the key we
 * generate is always predictable and the content type presigned into the PUT
 * matches what the browser will actually send.
 */
const ALLOWED_VIDEO_MIME_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

/**
 * Allowlisted image mime types → S3 key extension, for course thumbnails.
 * Same fixed-map rationale as the video list above: never trust the client's
 * file extension for the key we generate.
 */
const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const trainingUploadService = {
  /**
   * Option A (single PUT) presigned upload for training media: the browser PUTs
   * the file straight to S3 using `uploadUrl`; the server never buffers it.
   * Handles both lesson `video`s and course thumbnail `image`s — the only
   * difference is the allowed mime set and the S3 key prefix. `playbackUrl`
   * reuses the existing generic `/api/v2/files/img?key=` S3 proxy (see
   * training.routes.ts for why it's reused instead of duplicated) so the client
   * can store it directly as `videoUrl` / `thumbnailUrl`.
   */
  async presignUpload(input: PresignUploadInput): Promise<PresignUploadResult> {
    const isImage = input.kind === 'image';
    const allowed = isImage ? ALLOWED_IMAGE_MIME_TYPES : ALLOWED_VIDEO_MIME_TYPES;
    const ext = allowed[input.contentType];
    if (!ext) {
      throw new AppError(
        `Unsupported ${input.kind} type: ${input.contentType}. Allowed: ${Object.keys(allowed).join(', ')}`,
        400,
      );
    }

    const prefix = isImage ? 'training-thumbnails' : 'training-videos';
    const key = `${prefix}/${Date.now()}-${randomUUID()}${ext}`;
    const uploadUrl = await getPresignedPutUrl(key, input.contentType);
    const playbackUrl = buildImageProxyUrl(key);

    return { uploadUrl, key, playbackUrl };
  },
};
