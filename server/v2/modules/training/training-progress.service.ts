import { trainingProgressRepository } from './training-progress.repository';
import { trainingLessonRepository } from './training-lesson.repository';
import { trainingSectionRepository } from './training-section.repository';
import { trainingQuizRepository } from './training-quiz.repository';
import { trainingService } from './training.service';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import type { TrainingEnrollment, TrainingLesson, TrainingLessonProgress, TrainingQuiz, TrainingSection } from '@shared/schema';
import type { LessonProgressInput, MyCourseStatus } from './training.types';

/**
 * Everything the gating rules need for one enrollment, loaded once: the
 * course's ordered sections and lessons, the learner's lesson progress, and
 * the per-section quiz rows with the set of quiz ids this enrollment has
 * passed.
 */
interface ProgressContext {
  sections: TrainingSection[];
  /** Ordered course-wide: sections by position, lessons by position within each. */
  lessons: TrainingLesson[];
  progressByLesson: Map<string, TrainingLessonProgress>;
  quizBySectionId: Map<string, TrainingQuiz>;
  passedQuizIds: Set<string>;
}

async function loadProgressContext(courseId: string, enrollmentId: string): Promise<ProgressContext> {
  const [sections, lessons, progressRows, sectionQuizzes] = await Promise.all([
    trainingSectionRepository.listSectionsByCourseId(courseId),
    trainingLessonRepository.listLessonsByCourseId(courseId),
    trainingProgressRepository.listProgressByEnrollmentId(enrollmentId),
    trainingQuizRepository.listSectionQuizzesByCourseId(courseId),
  ]);
  const attempts = await trainingQuizRepository.listAttemptsByEnrollmentAndQuizIds(
    enrollmentId,
    sectionQuizzes.map((q) => q.id),
  );
  return {
    sections,
    lessons,
    progressByLesson: new Map(progressRows.map((p) => [p.lesson_id, p])),
    quizBySectionId: new Map(sectionQuizzes.map((q) => [q.section_id as string, q])),
    passedQuizIds: new Set(attempts.filter((a) => a.passed).map((a) => a.quiz_id)),
  };
}

/** True when the section has no quiz, an optional quiz, or a required quiz the learner has passed. */
function sectionQuizSatisfied(ctx: ProgressContext, sectionId: string): boolean {
  const quiz = ctx.quizBySectionId.get(sectionId);
  if (!quiz || !quiz.is_required) return true;
  return ctx.passedQuizIds.has(quiz.id);
}

/** Every required lesson of the section has `completed = true`. */
function sectionLessonsComplete(ctx: ProgressContext, sectionId: string): boolean {
  return ctx.lessons
    .filter((lesson) => lesson.section_id === sectionId && lesson.is_required)
    .every((lesson) => ctx.progressByLesson.get(lesson.id)?.completed === true);
}

/**
 * `contentComplete` = every required lesson in the course is completed AND
 * every required section quiz is passed. (A course with no required lessons
 * at all reports false, matching the pre-section behavior.)
 */
function computeContentComplete(ctx: ProgressContext): boolean {
  const requiredLessons = ctx.lessons.filter((lesson) => lesson.is_required);
  return (
    requiredLessons.length > 0 &&
    requiredLessons.every((lesson) => ctx.progressByLesson.get(lesson.id)?.completed === true) &&
    ctx.sections.every((section) => sectionQuizSatisfied(ctx, section.id))
  );
}

/**
 * Standalone content-complete check for a known enrollment, reused by the
 * quiz module (gating final-quiz attempts + the completion check) without
 * duplicating the lesson/progress query logic.
 */
export async function getContentComplete(courseId: string, enrollmentId: string): Promise<boolean> {
  const ctx = await loadProgressContext(courseId, enrollmentId);
  return computeContentComplete(ctx);
}

/**
 * Sequential progression: a lesson is LOCKED until every REQUIRED lesson
 * before it (sections in order, lessons in order within each) is completed
 * AND every REQUIRED section quiz of the sections before it is passed —
 * optional lessons and optional quizzes never block. Throws 400 when locked.
 * Shared by lesson-progress writes and lesson-quiz attempt submissions so
 * the client's locked sidebar can't be bypassed via the API.
 */
export async function assertLessonUnlocked(lesson: TrainingLesson, enrollmentId: string): Promise<void> {
  const ctx = await loadProgressContext(lesson.course_id, enrollmentId);

  for (const candidate of ctx.lessons) {
    if (candidate.id === lesson.id) break;
    if (candidate.is_required && ctx.progressByLesson.get(candidate.id)?.completed !== true) {
      throw new AppError('Complete the previous lessons first', 400);
    }
  }

  // Required quizzes of every section strictly before this lesson's section.
  for (const section of ctx.sections) {
    if (section.id === lesson.section_id) break;
    if (!sectionQuizSatisfied(ctx, section.id)) {
      throw new AppError("Pass the previous section's quiz first", 400);
    }
  }
}

/**
 * A section's quiz unlocks once everything before it is done — every prior
 * section's required lessons completed and required quiz passed — and the
 * section's own required lessons are completed. Throws 400 when locked.
 */
export async function assertSectionQuizUnlocked(section: TrainingSection, enrollmentId: string): Promise<void> {
  const ctx = await loadProgressContext(section.course_id, enrollmentId);

  for (const candidate of ctx.sections) {
    if (candidate.id === section.id) break;
    if (!sectionLessonsComplete(ctx, candidate.id)) {
      throw new AppError('Complete the previous lessons first', 400);
    }
    if (!sectionQuizSatisfied(ctx, candidate.id)) {
      throw new AppError("Pass the previous section's quiz first", 400);
    }
  }

  if (!sectionLessonsComplete(ctx, section.id)) {
    throw new AppError("Finish this section's lessons first", 400);
  }
}

export const trainingProgressService = {
  /** Idempotent: returns the existing enrollment if the learner is already enrolled. */
  async enroll(courseId: string, scope: Scope): Promise<{ enrollment: TrainingEnrollment; created: boolean }> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);

    // Learner-facing visibility check: must be published and in-scope,
    // 404-as-permission otherwise (mirrors `trainingService.getCourse`).
    await trainingService.getCourse(courseId, scope);

    return trainingProgressRepository.findOrCreateEnrollment({
      course_id: courseId,
      user_id: scope.userId,
      // orgId can be an empty string for users without an org context; the
      // org_id column is a uuid, so coalesce '' → null (else Postgres 22P02).
      org_id: scope.orgId || null,
      status: 'in_progress',
    });
  },

  /**
   * Upsert lesson progress. Auto-creates/resolves the caller's enrollment for
   * the lesson's course first, so a learner can start reporting progress
   * without an explicit prior `/enroll` call.
   */
  async updateLessonProgress(lessonId: string, input: LessonProgressInput, scope: Scope): Promise<TrainingLessonProgress> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);

    const lesson = await trainingLessonRepository.findLessonById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404);

    const { enrollment } = await trainingProgressRepository.findOrCreateEnrollment({
      course_id: lesson.course_id,
      user_id: scope.userId,
      // '' → null: org_id is a uuid column (see enroll() above).
      org_id: scope.orgId || null,
      status: 'in_progress',
    });

    await assertLessonUnlocked(lesson, enrollment.id);

    const progressPct = input.progressPct !== undefined ? Math.max(0, Math.min(100, input.progressPct)) : undefined;

    const patch: { progress_pct?: number; completed?: boolean } = {};
    if (progressPct !== undefined) patch.progress_pct = progressPct;
    if (input.completed !== undefined || progressPct !== undefined) {
      patch.completed = input.completed === true || (progressPct !== undefined && progressPct >= 90);
    }

    // A lesson with a REQUIRED quiz can only be completed by passing that quiz
    // (see trainingQuizService.submitLessonAttempt) — content progress alone
    // records the pct but never flips `completed`.
    if (patch.completed === true) {
      const lessonQuiz = await trainingQuizRepository.findQuizByLessonId(lessonId);
      if (lessonQuiz?.is_required) {
        const attempts = await trainingQuizRepository.listAttemptsByEnrollmentAndQuiz(enrollment.id, lessonQuiz.id);
        if (!attempts.some((a) => a.passed)) delete patch.completed;
      }
    }

    return trainingProgressRepository.upsertProgress(enrollment.id, lessonId, patch);
  },

  /**
   * The current user's enrollments (course id + status + content-progress %) —
   * for the "My Courses" filter and the per-card progress bar on the catalog.
   */
  async getMyEnrollments(
    scope: Scope,
  ): Promise<{ courseId: string; status: 'in_progress' | 'completed'; progressPct: number }[]> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);
    return trainingProgressRepository.listEnrollmentsByUser(scope.userId);
  },

  /**
   * `contentComplete` = every required lesson in the course has `completed = true`.
   * Also reports quiz state (Phase 3): whether the course has a quiz, the
   * learner's best score/attempt count, and completion + certificate — this
   * is what the learner UI uses to decide whether to show "take quiz",
   * "retake", or "passed + certificate".
   */
  async getMyStatus(courseId: string, scope: Scope): Promise<MyCourseStatus> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);

    await trainingService.getCourse(courseId, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestions(courseId);
    const hasQuiz = quizData !== undefined && quizData.questions.length > 0;

    const enrollment = await trainingProgressRepository.findEnrollment(courseId, scope.userId);
    if (!enrollment) {
      return {
        enrolled: false,
        lessonProgress: [],
        sectionProgress: [],
        contentComplete: false,
        hasQuiz,
        quizPassed: false,
        bestScorePct: null,
        attemptCount: 0,
        courseCompleted: false,
        certificate: null,
      };
    }

    const ctx = await loadProgressContext(courseId, enrollment.id);
    const { lessons, progressByLesson } = ctx;

    // Per-lesson and per-section quiz state: quiz rows keyed by their target,
    // plus this enrollment's attempts across all of them in one batch query.
    const lessonQuizzes = await trainingQuizRepository.listLessonQuizzesByCourseId(courseId);
    const quizByLessonId = new Map(lessonQuizzes.map((q) => [q.lesson_id as string, q]));
    const sectionQuizzes = [...ctx.quizBySectionId.values()];
    const subQuizAttempts = await trainingQuizRepository.listAttemptsByEnrollmentAndQuizIds(
      enrollment.id,
      [...lessonQuizzes, ...sectionQuizzes].map((q) => q.id),
    );
    const attemptsByQuizId = new Map<string, typeof subQuizAttempts>();
    for (const attempt of subQuizAttempts) {
      const list = attemptsByQuizId.get(attempt.quiz_id) ?? [];
      list.push(attempt);
      attemptsByQuizId.set(attempt.quiz_id, list);
    }

    const sectionProgress = ctx.sections.map((section) => {
      const sectionQuiz = ctx.quizBySectionId.get(section.id);
      const attempts = sectionQuiz ? attemptsByQuizId.get(sectionQuiz.id) ?? [] : [];

      let sectionQuizPassed = false;
      let sectionBestScorePct: number | null = null;
      for (const attempt of attempts) {
        if (attempt.passed) sectionQuizPassed = true;
        if (attempt.score_pct !== null && (sectionBestScorePct === null || attempt.score_pct > sectionBestScorePct)) {
          sectionBestScorePct = attempt.score_pct;
        }
      }

      return {
        sectionId: section.id,
        hasQuiz: sectionQuiz !== undefined,
        quizRequired: sectionQuiz?.is_required ?? false,
        quizPassed: sectionQuizPassed,
        bestScorePct: sectionBestScorePct,
        attemptCount: attempts.length,
      };
    });

    const lessonProgress = lessons.map((lesson) => {
      const progress = progressByLesson.get(lesson.id);
      const lessonQuiz = quizByLessonId.get(lesson.id);
      const attempts = lessonQuiz ? attemptsByQuizId.get(lessonQuiz.id) ?? [] : [];

      let lessonQuizPassed = false;
      let lessonBestScorePct: number | null = null;
      for (const attempt of attempts) {
        if (attempt.passed) lessonQuizPassed = true;
        if (attempt.score_pct !== null && (lessonBestScorePct === null || attempt.score_pct > lessonBestScorePct)) {
          lessonBestScorePct = attempt.score_pct;
        }
      }

      return {
        lessonId: lesson.id,
        completed: progress?.completed ?? false,
        progressPct: progress?.progress_pct ?? 0,
        hasQuiz: lessonQuiz !== undefined,
        quizRequired: lessonQuiz?.is_required ?? false,
        quizPassed: lessonQuizPassed,
        bestScorePct: lessonBestScorePct,
        attemptCount: attempts.length,
      };
    });

    const contentComplete = computeContentComplete(ctx);

    let quizPassed = false;
    let bestScorePct: number | null = null;
    let attemptCount = 0;
    let certificate: MyCourseStatus['certificate'] = null;

    if (quizData) {
      const attempts = await trainingQuizRepository.listAttemptsByEnrollmentAndQuiz(enrollment.id, quizData.quiz.id);
      attemptCount = attempts.length;
      for (const attempt of attempts) {
        if (attempt.passed) quizPassed = true;
        if (attempt.score_pct !== null && (bestScorePct === null || attempt.score_pct > bestScorePct)) {
          bestScorePct = attempt.score_pct;
        }
      }

      const cert = await trainingQuizRepository.findCertificateByEnrollmentId(enrollment.id);
      if (cert) certificate = { certificate_no: cert.certificate_no, issued_at: cert.issued_at };
    }

    return {
      enrolled: true,
      lessonProgress,
      sectionProgress,
      contentComplete,
      hasQuiz,
      quizPassed,
      bestScorePct,
      attemptCount,
      courseCompleted: enrollment.status === 'completed',
      certificate,
    };
  },
};
