import { db } from '../../config/database';
import { training_section } from '@shared/schema';
import type { TrainingSection, InsertTrainingSection } from '@shared/schema';
import { asc, eq, sql } from 'drizzle-orm';

export const trainingSectionRepository = {
  async createSection(data: InsertTrainingSection): Promise<TrainingSection> {
    const [result] = await db.insert(training_section).values(data).returning();
    return result;
  },

  async updateSection(id: string, patch: Partial<InsertTrainingSection>): Promise<TrainingSection | undefined> {
    const [result] = await db
      .update(training_section)
      .set({ ...patch, updated_at: new Date() })
      .where(eq(training_section.id, id))
      .returning();
    return result;
  },

  async findSectionById(id: string): Promise<TrainingSection | undefined> {
    const [result] = await db.select().from(training_section).where(eq(training_section.id, id)).limit(1);
    return result;
  },

  async deleteSection(id: string): Promise<void> {
    await db.delete(training_section).where(eq(training_section.id, id));
  },

  /** Ordered sections for a course — the spine of the course content tree. */
  async listSectionsByCourseId(courseId: string): Promise<TrainingSection[]> {
    return db
      .select()
      .from(training_section)
      .where(eq(training_section.course_id, courseId))
      .orderBy(asc(training_section.position));
  },

  /** Next append position for a new section within a course. */
  async getNextSectionPosition(courseId: string): Promise<number> {
    const [row] = await db
      .select({ maxPos: sql<number>`coalesce(max(${training_section.position}), -1)` })
      .from(training_section)
      .where(eq(training_section.course_id, courseId));
    return (row?.maxPos ?? -1) + 1;
  },

  /** Persist a new ordering for a set of sections (each row updated by id). */
  async reorderSections(order: { id: string; position: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const entry of order) {
        await tx
          .update(training_section)
          .set({ position: entry.position, updated_at: new Date() })
          .where(eq(training_section.id, entry.id));
      }
    });
  },
};
