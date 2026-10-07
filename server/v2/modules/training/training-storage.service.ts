import { deleteImageByStoredUrl, buildImageProxyUrl } from '../../utils/image-storage';
import { trainingLessonRepository } from './training-lesson.repository';
import { trainingRepository } from './training.repository';
import { TRAINING_STORAGE_PREFIXES, keyHasPrefix, safeS3Key } from './training-storage.util';

/**
 * Best-effort S3 cleanup for a training media URL. Deletes the object ONLY if
 * (1) the URL is one of our S3 proxy URLs, (2) its key is under one of
 * `allowedPrefixes` (training folders), and (3) no other row still references
 * the same URL (asset rows, lesson videos, course thumbnails). Anything else
 * is a no-op, so a crafted URL can never delete a foreign object.
 */
export async function deleteTrainingObjectIfUnreferenced(
  storedUrl: string,
  allowedPrefixes: readonly string[] = TRAINING_STORAGE_PREFIXES,
): Promise<void> {
  const key = safeS3Key(storedUrl);
  if (!key || !keyHasPrefix(key, allowedPrefixes)) return;

  const canonical = buildImageProxyUrl(key);
  const urls = canonical === storedUrl ? [storedUrl] : [storedUrl, canonical];
  const counts = await Promise.all(
    urls.flatMap((url) => [
      trainingLessonRepository.countAssetsByUrl(url),
      trainingLessonRepository.countLessonsByVideoUrl(url),
      trainingRepository.countCoursesByThumbnailUrl(url),
    ]),
  );
  if (counts.some((n) => n > 0)) return;

  await deleteImageByStoredUrl(canonical);
}
