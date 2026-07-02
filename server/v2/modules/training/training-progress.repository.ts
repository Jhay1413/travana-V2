import { db } from '../../config/database';
import { training_enrollment, training_lesson_progress } from '@shared/schema';
import type {
  TrainingEnrollment,
  InsertTrainingEnrollment,
  TrainingLessonProgress,
} from '@shared/schema';
import { and, eq } from 'drizzle-orm';

export const trainingProgressRepository = {
  async findEnrollment(courseId: string, userId: string): Promise<TrainingEnrollment | undefined> {
    const [row] = await db
      .select()
      .from(training_enrollment)
      .where(and(eq(training_enrollment.course_id, courseId), eq(training_enrollment.user_id, userId)))
      .limit(1);
    return row;
  },

  /**
   * Idempotent enroll: relies on `unique(course_id, user_id)`. If the insert
   * hits the conflict it's a no-op and we fall back to the existing row —
   * this avoids a check-then-insert race between concurrent requests.
   */
  async findOrCreateEnrollment(data: InsertTrainingEnrollment): Promise<{ enrollment: TrainingEnrollment; created: boolean }> {
    const [inserted] = await db
      .insert(training_enrollment)
      .values(data)
      .onConflictDoNothing({ target: [training_enrollment.course_id, training_enrollment.user_id] })
      .returning();
    if (inserted) return { enrollment: inserted, created: true };

    const existing = await this.findEnrollment(data.course_id, data.user_id);
    if (!existing) {
      throw new Error(`Enrollment upsert failed for course ${data.course_id} user ${data.user_id}`);
    }
    return { enrollment: existing, created: false };
  },

  async listProgressByEnrollmentId(enrollmentId: string): Promise<TrainingLessonProgress[]> {
    return db.select().from(training_lesson_progress).where(eq(training_lesson_progress.enrollment_id, enrollmentId));
  },

  /** Flip an enrollment to `completed` once content is done and the quiz is passed. */
  async markCompleted(enrollmentId: string): Promise<TrainingEnrollment | undefined> {
    const [row] = await db
      .update(training_enrollment)
      .set({ status: 'completed', completed_at: new Date() })
      .where(eq(training_enrollment.id, enrollmentId))
      .returning();
    return row;
  },

  /**
   * Upsert keyed on `unique(enrollment_id, lesson_id)`. Only fields present in
   * `patch` are overwritten on conflict, so a partial update (e.g. only
   * `completed`) doesn't clobber a previously recorded `progress_pct`.
   */
  async upsertProgress(
    enrollmentId: string,
    lessonId: string,
    patch: { progress_pct?: number; completed?: boolean },
  ): Promise<TrainingLessonProgress> {
    const now = new Date();
    const [row] = await db
      .insert(training_lesson_progress)
      .values({
        enrollment_id: enrollmentId,
        lesson_id: lessonId,
        progress_pct: patch.progress_pct ?? 0,
        completed: patch.completed ?? false,
        last_viewed_at: now,
      })
      .onConflictDoUpdate({
        target: [training_lesson_progress.enrollment_id, training_lesson_progress.lesson_id],
        set: {
          ...(patch.progress_pct !== undefined ? { progress_pct: patch.progress_pct } : {}),
          ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
          last_viewed_at: now,
        },
      })
      .returning();
    return row;
  },
};
