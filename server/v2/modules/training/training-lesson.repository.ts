import { db } from '../../config/database';
import { training_lesson, training_lesson_asset, training_section } from '@shared/schema';
import type {
  TrainingLesson,
  InsertTrainingLesson,
  TrainingLessonAsset,
  InsertTrainingLessonAsset,
} from '@shared/schema';
import { asc, eq, inArray, sql } from 'drizzle-orm';

export const trainingLessonRepository = {
  async createLesson(data: InsertTrainingLesson): Promise<TrainingLesson> {
    const [result] = await db.insert(training_lesson).values(data).returning();
    return result;
  },

  async updateLesson(id: string, patch: Partial<InsertTrainingLesson>): Promise<TrainingLesson | undefined> {
    const [result] = await db
      .update(training_lesson)
      .set({ ...patch, updated_at: new Date() })
      .where(eq(training_lesson.id, id))
      .returning();
    return result;
  },

  async findLessonById(id: string): Promise<TrainingLesson | undefined> {
    const [result] = await db.select().from(training_lesson).where(eq(training_lesson.id, id)).limit(1);
    return result;
  },

  async deleteLesson(id: string): Promise<void> {
    await db.delete(training_lesson).where(eq(training_lesson.id, id));
  },

  /**
   * Every lesson of a course in course order: sections by their position,
   * then lessons by position within each section. This flat ordered list is
   * what sequential progression walks.
   */
  async listLessonsByCourseId(courseId: string): Promise<TrainingLesson[]> {
    const rows = await db
      .select({ lesson: training_lesson })
      .from(training_lesson)
      .innerJoin(training_section, eq(training_section.id, training_lesson.section_id))
      .where(eq(training_lesson.course_id, courseId))
      .orderBy(asc(training_section.position), asc(training_lesson.position));
    return rows.map((r) => r.lesson);
  },

  /** Ordered lessons within a single section. */
  async listLessonsBySectionId(sectionId: string): Promise<TrainingLesson[]> {
    return db
      .select()
      .from(training_lesson)
      .where(eq(training_lesson.section_id, sectionId))
      .orderBy(asc(training_lesson.position));
  },

  /** Next append position for a new lesson within a section. */
  async getNextLessonPosition(sectionId: string): Promise<number> {
    const [row] = await db
      .select({ maxPos: sql<number>`coalesce(max(${training_lesson.position}), -1)` })
      .from(training_lesson)
      .where(eq(training_lesson.section_id, sectionId));
    return (row?.maxPos ?? -1) + 1;
  },

  /** Persist a new ordering for a set of lessons (each row updated by id). */
  async reorderLessons(order: { id: string; position: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const entry of order) {
        await tx
          .update(training_lesson)
          .set({ position: entry.position, updated_at: new Date() })
          .where(eq(training_lesson.id, entry.id));
      }
    });
  },

  async createAssets(data: InsertTrainingLessonAsset[]): Promise<TrainingLessonAsset[]> {
    if (data.length === 0) return [];
    return db.insert(training_lesson_asset).values(data).returning();
  },

  async findAssetById(id: string): Promise<TrainingLessonAsset | undefined> {
    const [result] = await db.select().from(training_lesson_asset).where(eq(training_lesson_asset.id, id)).limit(1);
    return result;
  },

  async deleteAsset(id: string): Promise<void> {
    await db.delete(training_lesson_asset).where(eq(training_lesson_asset.id, id));
  },

  /** Ordered assets for a single lesson. */
  async listAssetsByLessonId(lessonId: string): Promise<TrainingLessonAsset[]> {
    return db
      .select()
      .from(training_lesson_asset)
      .where(eq(training_lesson_asset.lesson_id, lessonId))
      .orderBy(asc(training_lesson_asset.position));
  },

  /** Batch fetch, ordered, for building a course's full content tree in one query. */
  async listAssetsByLessonIds(lessonIds: string[]): Promise<TrainingLessonAsset[]> {
    if (lessonIds.length === 0) return [];
    return db
      .select()
      .from(training_lesson_asset)
      .where(inArray(training_lesson_asset.lesson_id, lessonIds))
      .orderBy(asc(training_lesson_asset.position));
  },

  /** Next append position for a new asset within a lesson. */
  async getNextAssetPosition(lessonId: string): Promise<number> {
    const [row] = await db
      .select({ maxPos: sql<number>`coalesce(max(${training_lesson_asset.position}), -1)` })
      .from(training_lesson_asset)
      .where(eq(training_lesson_asset.lesson_id, lessonId));
    return (row?.maxPos ?? -1) + 1;
  },
};
