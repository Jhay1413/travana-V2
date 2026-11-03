import { db } from '../../config/database';
import {
  training_certificate,
  training_course,
  training_enrollment,
  training_lesson,
  training_lesson_progress,
} from '@shared/schema';
import type {
  TrainingEnrollment,
  InsertTrainingEnrollment,
  TrainingLessonProgress,
} from '@shared/schema';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

export interface EnrollmentDetailRow {
  enrollmentId: string;
  courseId: string;
  title: string;
  category: string;
  status: TrainingEnrollment['status'];
  enrolledAt: Date;
  completedAt: Date | null;
  lessonsTotal: number;
  lessonsCompleted: number;
  certificate: { issuedAt: Date; certificateNo: string | null } | null;
}

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

  /**
   * Every course the user is enrolled in, with its enrollment status and a
   * content-progress percentage — powers the "My Courses" filter and the
   * per-card progress bar on the catalog. `progressPct` = completed required
   * lessons / total required lessons (mirrors the course-view progress bar),
   * forced to 100 once the enrollment itself is `completed`. Courses with no
   * required lessons report 0 (or 100 when completed).
   */
  async listEnrollmentsByUser(
    userId: string,
  ): Promise<{ courseId: string; status: TrainingEnrollment['status']; progressPct: number }[]> {
    const rows = await db
      .select({
        courseId: training_enrollment.course_id,
        status: training_enrollment.status,
        requiredTotal: sql<number>`count(${training_lesson.id}) filter (where ${training_lesson.is_required})`,
        requiredCompleted: sql<number>`count(${training_lesson.id}) filter (where ${training_lesson.is_required} and ${training_lesson_progress.completed})`,
      })
      .from(training_enrollment)
      .leftJoin(training_lesson, eq(training_lesson.course_id, training_enrollment.course_id))
      .leftJoin(
        training_lesson_progress,
        and(
          eq(training_lesson_progress.lesson_id, training_lesson.id),
          eq(training_lesson_progress.enrollment_id, training_enrollment.id),
        ),
      )
      .where(eq(training_enrollment.user_id, userId))
      .groupBy(training_enrollment.id, training_enrollment.course_id, training_enrollment.status);

    return rows.map((row) => {
      // Postgres count() comes back as a string (bigint) — coerce before math.
      const total = Number(row.requiredTotal);
      const completed = Number(row.requiredCompleted);
      const progressPct =
        row.status === 'completed' ? 100 : total > 0 ? Math.round((completed / total) * 100) : 0;
      return { courseId: row.courseId, status: row.status, progressPct };
    });
  },

  /**
   * Admin view of one user's enrolments: course title/category, REQUIRED lesson counts (same basis as
   * listEnrollmentsByUser, so the profile matches /my-courses) and the issued certificate, if any. Only courses that are
   * global (no org) or belong to `orgId` are returned, so another organisation's course never leaks.
   */
  async listEnrollmentDetailsByUser(userId: string, orgId: string): Promise<EnrollmentDetailRow[]> {
    const rows = await db
      .select({
        enrollmentId: training_enrollment.id,
        courseId: training_course.id,
        title: training_course.title,
        category: training_course.category,
        status: training_enrollment.status,
        enrolledAt: training_enrollment.enrolled_at,
        completedAt: training_enrollment.completed_at,
        lessonsTotal: sql<number>`count(${training_lesson.id}) filter (where ${training_lesson.is_required})`,
        lessonsCompleted: sql<number>`count(${training_lesson.id}) filter (where ${training_lesson.is_required} and ${training_lesson_progress.completed})`,
        certificateId: training_certificate.id,
        certificateIssuedAt: training_certificate.issued_at,
        certificateNo: training_certificate.certificate_no,
      })
      .from(training_enrollment)
      .innerJoin(training_course, eq(training_course.id, training_enrollment.course_id))
      .leftJoin(training_lesson, eq(training_lesson.course_id, training_course.id))
      .leftJoin(
        training_lesson_progress,
        and(
          eq(training_lesson_progress.lesson_id, training_lesson.id),
          eq(training_lesson_progress.enrollment_id, training_enrollment.id),
        ),
      )
      .leftJoin(training_certificate, eq(training_certificate.enrollment_id, training_enrollment.id))
      .where(
        and(
          eq(training_enrollment.user_id, userId),
          or(isNull(training_course.org_id), eq(training_course.org_id, orgId)),
        ),
      )
      .groupBy(training_enrollment.id, training_course.id, training_certificate.id)
      .orderBy(sql`${training_enrollment.enrolled_at} desc`);

    return rows.map((r) => ({
      enrollmentId: r.enrollmentId,
      courseId: r.courseId,
      title: r.title,
      category: r.category,
      status: r.status,
      enrolledAt: r.enrolledAt,
      completedAt: r.completedAt,
      // Postgres count() comes back as a string (bigint).
      lessonsTotal: Number(r.lessonsTotal),
      lessonsCompleted: Number(r.lessonsCompleted),
      certificate: r.certificateId ? { issuedAt: r.certificateIssuedAt as Date, certificateNo: r.certificateNo ?? null } : null,
    }));
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
   * Upsert keyed on `unique(enrollment_id, lesson_id)`. Progress is MONOTONIC:
   * on conflict we keep `GREATEST(existing, incoming)` for `progress_pct` and
   * never revert `completed` from true → false. This is the source-of-truth
   * guard against a replay starting at position 0 (which emits a near-zero pct)
   * clobbering the learner's real furthest progress. Only fields present in
   * `patch` are touched, so a partial update doesn't affect the other column.
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
          // Never lower a recorded pct; never un-complete a completed lesson.
          ...(patch.progress_pct !== undefined
            ? { progress_pct: sql`GREATEST(${training_lesson_progress.progress_pct}, ${patch.progress_pct})` }
            : {}),
          ...(patch.completed !== undefined
            ? { completed: sql`${training_lesson_progress.completed} OR ${patch.completed}` }
            : {}),
          last_viewed_at: now,
        },
      })
      .returning();
    return row;
  },
};
