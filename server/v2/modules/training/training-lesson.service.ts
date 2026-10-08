import { trainingLessonRepository } from './training-lesson.repository';
import { trainingService } from './training.service';
import { getSectionOrThrow } from './training-section.service';
import type { ScopeOrTrusted } from './training.repository';
import type { UpdateAssetBody } from './training-lesson.validator';
import { AppError } from '../../utils/error-handler';
import { uploadImageToS3 } from '../../utils/image-storage';
import { normalizeTrainingUrl, TRAINING_ASSET_PREFIX, TRAINING_VIDEO_PREFIX } from './training-storage.util';
import { deleteTrainingObjectIfUnreferenced } from './training-storage.service';
import type {
  TrainingLesson,
  InsertTrainingLesson,
  TrainingLessonAsset,
  InsertTrainingLessonAsset,
} from '@shared/schema';
import type {
  CreateLessonInput,
  UpdateLessonInput,
  CreateAssetInput,
  LessonReorderEntry,
} from './training.types';

async function getLessonOrThrow(lessonId: string): Promise<TrainingLesson> {
  const lesson = await trainingLessonRepository.findLessonById(lessonId);
  if (!lesson) throw new AppError('Lesson not found', 404);
  return lesson;
}

/** Trim; blank / missing becomes null. */
function normalizeCaption(caption: string | null | undefined): string | null {
  const trimmed = caption?.trim();
  return trimmed ? trimmed : null;
}

export const trainingLessonService = {
  async createLesson(sectionId: string, input: CreateLessonInput, scope: ScopeOrTrusted): Promise<TrainingLesson> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.assertCourseEditable(section.course_id, scope);

    if (input.type === 'video' && !input.videoUrl) {
      throw new AppError('videoUrl is required for video lessons', 400);
    }

    const videoUrl =
      input.type === 'video' && input.videoUrl
        ? normalizeTrainingUrl(input.videoUrl, TRAINING_VIDEO_PREFIX, 'videoUrl')
        : null;

    const position = input.position ?? (await trainingLessonRepository.getNextLessonPosition(sectionId));

    const data: InsertTrainingLesson = {
      course_id: section.course_id,
      section_id: sectionId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      position,
      is_required: input.isRequired ?? true,
      video_url: videoUrl,
      video_duration_sec: input.type === 'video' ? input.videoDurationSec ?? null : null,
    };

    return trainingLessonRepository.createLesson(data);
  },

  async updateLesson(lessonId: string, input: UpdateLessonInput, scope: ScopeOrTrusted): Promise<TrainingLesson> {
    const lesson = await getLessonOrThrow(lessonId);
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    const nextType = input.type ?? lesson.type;
    const nextVideoUrl = input.videoUrl !== undefined ? input.videoUrl : lesson.video_url;
    if (nextType === 'video' && !nextVideoUrl) {
      throw new AppError('videoUrl is required for video lessons', 400);
    }

    const patch: Partial<InsertTrainingLesson> = {};
    // Moving to another section: the target must belong to the same course.
    if (input.sectionId !== undefined && input.sectionId !== lesson.section_id) {
      const target = await getSectionOrThrow(input.sectionId);
      if (target.course_id !== lesson.course_id) {
        throw new AppError('Target section does not belong to this course', 400);
      }
      patch.section_id = input.sectionId;
      if (input.position === undefined) {
        patch.position = await trainingLessonRepository.getNextLessonPosition(input.sectionId);
      }
    }
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.position !== undefined) patch.position = input.position;
    if (input.isRequired !== undefined) patch.is_required = input.isRequired;
    if (input.type !== undefined) patch.type = input.type;
    if (input.videoUrl !== undefined) {
      patch.video_url = input.videoUrl ? normalizeTrainingUrl(input.videoUrl, TRAINING_VIDEO_PREFIX, 'videoUrl') : null;
    }
    if (input.videoDurationSec !== undefined) patch.video_duration_sec = input.videoDurationSec ?? null;

    const updated = await trainingLessonRepository.updateLesson(lessonId, patch);
    if (!updated) throw new AppError('Lesson not found', 404);
    return updated;
  },

  async deleteLesson(lessonId: string, scope: ScopeOrTrusted): Promise<void> {
    const lesson = await getLessonOrThrow(lessonId);
    await trainingService.assertCourseEditable(lesson.course_id, scope);
    await trainingLessonRepository.deleteLesson(lessonId);
  },

  /** Persist a new position for every lesson in `order`; all ids must belong to `sectionId`. */
  async reorderLessons(sectionId: string, order: LessonReorderEntry[], scope: ScopeOrTrusted): Promise<TrainingLesson[]> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.assertCourseEditable(section.course_id, scope);

    const lessons = await trainingLessonRepository.listLessonsBySectionId(sectionId);
    const validIds = new Set(lessons.map((l) => l.id));
    for (const entry of order) {
      if (!validIds.has(entry.id)) {
        throw new AppError(`Lesson ${entry.id} does not belong to this section`, 400);
      }
    }

    await trainingLessonRepository.reorderLessons(order);
    return trainingLessonRepository.listLessonsBySectionId(sectionId);
  },

  /** Persist a new position for every slide in `order`; all ids must belong to `lessonId`. */
  async reorderAssets(lessonId: string, order: LessonReorderEntry[], scope: ScopeOrTrusted): Promise<TrainingLessonAsset[]> {
    const lesson = await getLessonOrThrow(lessonId);
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    const assets = await trainingLessonRepository.listAssetsByLessonId(lessonId);
    const validIds = new Set(assets.map((a) => a.id));
    for (const entry of order) {
      if (!validIds.has(entry.id)) {
        throw new AppError(`Asset ${entry.id} does not belong to this lesson`, 400);
      }
    }

    await trainingLessonRepository.reorderAssets(order);
    return trainingLessonRepository.listAssetsByLessonId(lessonId);
  },

  /** Add asset rows from already-known URLs (complements the direct multer upload below). */
  async addAssetUrls(lessonId: string, assets: CreateAssetInput[], scope: ScopeOrTrusted): Promise<TrainingLessonAsset[]> {
    const lesson = await getLessonOrThrow(lessonId);
    await trainingService.assertCourseEditable(lesson.course_id, scope);
    if (lesson.type !== 'graphics') {
      throw new AppError('Assets can only be added to graphics lessons', 400);
    }

    // Reject URLs pointing at someone else's S3 object (and canonicalise ours).
    const urls = assets.map((asset) => normalizeTrainingUrl(asset.assetUrl, TRAINING_ASSET_PREFIX, 'assetUrl'));

    const startPosition = await trainingLessonRepository.getNextAssetPosition(lessonId);
    const rows: InsertTrainingLessonAsset[] = assets.map((asset, index) => ({
      lesson_id: lessonId,
      asset_url: urls[index],
      caption: asset.caption ?? null,
      position: asset.position ?? startPosition + index,
    }));

    return trainingLessonRepository.createAssets(rows);
  },

  /**
   * Multer-based upload: stream each image to S3 under `training-assets/`, then persist rows.
   * `captions` is the already-validated optional array aligned by index with `files`.
   */
  async uploadAssets(
    lessonId: string,
    files: Express.Multer.File[],
    scope: ScopeOrTrusted,
    captions: (string | null)[] = [],
  ): Promise<TrainingLessonAsset[]> {
    const lesson = await getLessonOrThrow(lessonId);
    await trainingService.assertCourseEditable(lesson.course_id, scope);
    if (lesson.type !== 'graphics') {
      throw new AppError('Assets can only be uploaded to graphics lessons', 400);
    }
    if (!files || files.length === 0) {
      throw new AppError('No files provided', 400);
    }
    if (captions.length > files.length) {
      throw new AppError('captions has more entries than files', 400);
    }

    const startPosition = await trainingLessonRepository.getNextAssetPosition(lessonId);
    const urls = await Promise.all(files.map((file) => uploadImageToS3(file, 'training-assets')));
    const rows: InsertTrainingLessonAsset[] = urls.map((url, index) => ({
      lesson_id: lessonId,
      asset_url: url,
      caption: normalizeCaption(captions[index]),
      position: startPosition + index,
    }));

    return trainingLessonRepository.createAssets(rows);
  },

  async updateAsset(assetId: string, input: UpdateAssetBody, scope: ScopeOrTrusted): Promise<TrainingLessonAsset> {
    const asset = await trainingLessonRepository.findAssetById(assetId);
    if (!asset) throw new AppError('Asset not found', 404);

    const lesson = await getLessonOrThrow(asset.lesson_id);
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    const updated = await trainingLessonRepository.updateAsset(assetId, { caption: normalizeCaption(input.caption) });
    if (!updated) throw new AppError('Asset not found', 404);
    return updated;
  },

  async deleteAsset(assetId: string, scope: ScopeOrTrusted): Promise<void> {
    const asset = await trainingLessonRepository.findAssetById(assetId);
    if (!asset) throw new AppError('Asset not found', 404);

    const lesson = await getLessonOrThrow(asset.lesson_id);
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    await trainingLessonRepository.deleteAsset(assetId);
    // Only removes the S3 object when it is a training asset no other row still references.
    await deleteTrainingObjectIfUnreferenced(asset.asset_url, [TRAINING_ASSET_PREFIX]).catch(() => {});
  },
};
