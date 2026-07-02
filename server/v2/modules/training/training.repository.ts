import { db } from '../../config/database';
import { training_course } from '@shared/schema';
import type { TrainingCourse, InsertTrainingCourse } from '@shared/schema';
import { and, desc, eq, isNull, or, type SQL } from 'drizzle-orm';
import type { Scope } from '../../utils/scope';

export type ScopeOrTrusted = Scope | { orgId: null };

/**
 * Visibility predicate for `training_course`. `org_id IS NULL` means the course
 * is global (visible to every tenant); every other course is visible only to
 * its own org. `platform_admin` (and a trusted internal caller, `{ orgId: null }`)
 * see everything, no restriction. Kept in one place per docs/training-lms-plan.md §9.
 */
export function buildTrainingVisibilityConds(scope: ScopeOrTrusted): SQL[] {
  if (scope.orgId === null) return []; // trusted internal caller — no restriction
  const s = scope as Scope;
  if (s.orgRole === 'platform_admin') return [];

  // A user with no org context (orgId is '' / falsy) can only see global
  // courses. Comparing '' against the uuid org_id column would throw 22P02.
  if (!s.orgId) return [isNull(training_course.org_id)];

  const cond = or(isNull(training_course.org_id), eq(training_course.org_id, s.orgId));
  return cond ? [cond] : [];
}

export const trainingRepository = {
  async createCourse(data: InsertTrainingCourse): Promise<TrainingCourse> {
    const [result] = await db.insert(training_course).values(data).returning();
    return result;
  },

  async updateCourse(id: string, patch: Partial<InsertTrainingCourse>): Promise<TrainingCourse | undefined> {
    const [result] = await db
      .update(training_course)
      .set({ ...patch, updated_at: new Date() })
      .where(eq(training_course.id, id))
      .returning();
    return result;
  },

  async findCourseById(id: string): Promise<TrainingCourse | undefined> {
    const [result] = await db.select().from(training_course).where(eq(training_course.id, id)).limit(1);
    return result;
  },

  async setCourseStatus(id: string, status: TrainingCourse['status']): Promise<TrainingCourse | undefined> {
    const [result] = await db
      .update(training_course)
      .set({ status, updated_at: new Date() })
      .where(eq(training_course.id, id))
      .returning();
    return result;
  },

  /** Hard delete — reserved for drafts; published/archived courses should be archived instead. */
  async deleteCourse(id: string): Promise<void> {
    await db.delete(training_course).where(eq(training_course.id, id));
  },

  /** platform_admin (the only role that reaches this) sees every course regardless of status. */
  async listCoursesForAdmin(scope: ScopeOrTrusted): Promise<TrainingCourse[]> {
    const conds = buildTrainingVisibilityConds(scope);
    const query = db.select().from(training_course).orderBy(desc(training_course.created_at));
    return conds.length > 0 ? query.where(and(...conds)) : query;
  },

  /** Learner-facing: published courses only, visibility-scoped. */
  async listPublishedCoursesForLearner(scope: ScopeOrTrusted): Promise<TrainingCourse[]> {
    const visibilityConds = buildTrainingVisibilityConds(scope);
    const conds = [eq(training_course.status, 'published'), ...visibilityConds];
    return db
      .select()
      .from(training_course)
      .where(and(...conds))
      .orderBy(desc(training_course.created_at));
  },
};
