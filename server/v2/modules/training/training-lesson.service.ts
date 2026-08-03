import { trainingLessonRepository } from './training-lesson.repository';
import { trainingService } from './training.service';
import { getSectionOrThrow } from './training-section.service';
import type { ScopeOrTrusted } from './training.repository';
import { AppError } from '../../utils/error-handler';
import { uploadImageToS3, deleteImageByStoredUrl } from '../../utils/image-storage';
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

export const trainingLessonService = {
  async createLesson(sectionId: string, input: CreateLessonInput, scope: ScopeOrTrusted): Promise<TrainingLesson> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.assertCourseEditable(section.course_id, scope);

    if (input.type === 'video' && !input.videoUrl) {
      throw new AppError('videoUrl is required for video lessons', 400);
    }

    const position = input.position ?? (await trainingLessonRepository.getNextLessonPosition(sectionId));

    const data: InsertTrainingLesson = {
      course_id: section.course_id,
      section_id: sectionId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      position,
      is_required: input.isRequired ?? true,
      video_url: input.type === 'video' ? input.videoUrl ?? null : null,
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
    if (input.videoUrl !== undefined) patch.video_url = input.videoUrl ?? null;
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

  /** Add asset rows from already-known URLs (complements the direct multer upload below). */
  async addAssetUrls(lessonId: string, assets: CreateAssetInput[], scope: ScopeOrTrusted): Promise<TrainingLessonAsset[]> {
    const lesson = await getLessonOrThrow(lessonId);
    if (lesson.type !== 'graphics') {
      throw new AppError('Assets can only be added to graphics lessons', 400);
    }
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    const startPosition = await trainingLessonRepository.getNextAssetPosition(lessonId);
    const rows: InsertTrainingLessonAsset[] = assets.map((asset, index) => ({
      lesson_id: lessonId,
      asset_url: asset.assetUrl,
      caption: asset.caption ?? null,
      position: asset.position ?? startPosition + index,
    }));

    return trainingLessonRepository.createAssets(rows);
  },

  /** Multer-based upload: stream each image to S3 under `training-assets/`, then persist rows. */
  async uploadAssets(lessonId: string, files: Express.Multer.File[], scope: ScopeOrTrusted): Promise<TrainingLessonAsset[]> {
    const lesson = await getLessonOrThrow(lessonId);
    if (lesson.type !== 'graphics') {
      throw new AppError('Assets can only be uploaded to graphics lessons', 400);
    }
    if (!files || files.length === 0) {
      throw new AppError('No files provided', 400);
    }
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    const startPosition = await trainingLessonRepository.getNextAssetPosition(lessonId);
    const urls = await Promise.all(files.map((file) => uploadImageToS3(file, 'training-assets')));
    const rows: InsertTrainingLessonAsset[] = urls.map((url, index) => ({
      lesson_id: lessonId,
      asset_url: url,
      caption: null,
      position: startPosition + index,
    }));

    return trainingLessonRepository.createAssets(rows);
  },

  async deleteAsset(assetId: string, scope: ScopeOrTrusted): Promise<void> {
    const asset = await trainingLessonRepository.findAssetById(assetId);
    if (!asset) throw new AppError('Asset not found', 404);

    const lesson = await getLessonOrThrow(asset.lesson_id);
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    await trainingLessonRepository.deleteAsset(assetId);
    await deleteImageByStoredUrl(asset.asset_url).catch(() => {});
  },
};
