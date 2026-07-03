import { trainingProgressRepository } from './training-progress.repository';
import { trainingLessonRepository } from './training-lesson.repository';
import { trainingQuizRepository } from './training-quiz.repository';
import { trainingService } from './training.service';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import type { TrainingEnrollment, TrainingLesson, TrainingLessonProgress } from '@shared/schema';
import type { LessonProgressInput, MyCourseStatus } from './training.types';

/** `contentComplete` = every required lesson in the course has `completed = true`. */
function computeContentComplete(lessons: TrainingLesson[], progressByLesson: Map<string, TrainingLessonProgress>): boolean {
  const requiredLessons = lessons.filter((lesson) => lesson.is_required);
  return requiredLessons.length > 0 && requiredLessons.every((lesson) => progressByLesson.get(lesson.id)?.completed === true);
}

/**
 * Standalone content-complete check for a known enrollment, reused by the
 * quiz module (gating attempts + the completion check) without duplicating
 * the lesson/progress query logic.
 */
export async function getContentComplete(courseId: string, enrollmentId: string): Promise<boolean> {
  const lessons = await trainingLessonRepository.listLessonsByCourseId(courseId);
  const progressRows = await trainingProgressRepository.listProgressByEnrollmentId(enrollmentId);
  const progressByLesson = new Map(progressRows.map((p) => [p.lesson_id, p]));
  return computeContentComplete(lessons, progressByLesson);
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

    const progressPct = input.progressPct !== undefined ? Math.max(0, Math.min(100, input.progressPct)) : undefined;

    const patch: { progress_pct?: number; completed?: boolean } = {};
    if (progressPct !== undefined) patch.progress_pct = progressPct;
    if (input.completed !== undefined || progressPct !== undefined) {
      patch.completed = input.completed === true || (progressPct !== undefined && progressPct >= 90);
    }

    return trainingProgressRepository.upsertProgress(enrollment.id, lessonId, patch);
  },

  /** The current user's enrollments (course id + status) — for the "My Courses" filter. */
  async getMyEnrollments(scope: Scope): Promise<{ courseId: string; status: 'in_progress' | 'completed' }[]> {
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
        contentComplete: false,
        hasQuiz,
        quizPassed: false,
        bestScorePct: null,
        attemptCount: 0,
        courseCompleted: false,
        certificate: null,
      };
    }

    const lessons = await trainingLessonRepository.listLessonsByCourseId(courseId);
    const progressRows = await trainingProgressRepository.listProgressByEnrollmentId(enrollment.id);
    const progressByLesson = new Map(progressRows.map((p) => [p.lesson_id, p]));

    const lessonProgress = lessons.map((lesson) => {
      const progress = progressByLesson.get(lesson.id);
      return {
        lessonId: lesson.id,
        completed: progress?.completed ?? false,
        progressPct: progress?.progress_pct ?? 0,
      };
    });

    const contentComplete = computeContentComplete(lessons, progressByLesson);

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
