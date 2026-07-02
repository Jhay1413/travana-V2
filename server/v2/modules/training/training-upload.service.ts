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

export const trainingUploadService = {
  /**
   * Option A (single PUT) presigned video upload: the browser PUTs the file
   * straight to S3 using `uploadUrl`; the server never buffers the video.
   * `playbackUrl` reuses the existing generic `/api/v2/files/img?key=` S3
   * proxy (see training.routes.ts for why it's reused instead of duplicated)
   * so the client can store it directly on the lesson as `videoUrl`.
   */
  async presignVideoUpload(input: PresignUploadInput): Promise<PresignUploadResult> {
    const ext = ALLOWED_VIDEO_MIME_TYPES[input.contentType];
    if (!ext) {
      throw new AppError(
        `Unsupported video type: ${input.contentType}. Allowed: ${Object.keys(ALLOWED_VIDEO_MIME_TYPES).join(', ')}`,
        400,
      );
    }

    const key = `training-videos/${Date.now()}-${randomUUID()}${ext}`;
    const uploadUrl = await getPresignedPutUrl(key, input.contentType);
    const playbackUrl = buildImageProxyUrl(key);

    return { uploadUrl, key, playbackUrl };
  },
};
