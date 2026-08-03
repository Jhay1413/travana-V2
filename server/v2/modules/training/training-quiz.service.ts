import { randomBytes } from 'crypto';
import { trainingQuizRepository, type QuizQuestionWithChoices, type QuizWithQuestions, type QuizTreeQuestionInput } from './training-quiz.repository';
import { trainingProgressRepository } from './training-progress.repository';
import { trainingLessonRepository } from './training-lesson.repository';
import { getSectionOrThrow } from './training-section.service';
import { getContentComplete, assertLessonUnlocked, assertSectionQuizUnlocked } from './training-progress.service';
import { trainingService, isAdminContext } from './training.service';
import type { ScopeOrTrusted } from './training.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import type { TrainingLesson, TrainingQuiz } from '@shared/schema';
import type {
  UpsertQuizInput,
  QuizView,
  SubmitQuizInput,
  QuizAttemptResult,
  QuizAttemptQuestionResult,
  QuizCertificateView,
} from './training.types';

function shapeQuizView(quiz: TrainingQuiz, questions: QuizQuestionWithChoices[], includeCorrect: boolean): QuizView {
  return {
    quiz: { id: quiz.id, title: quiz.title, shuffleQuestions: quiz.shuffle_questions, isRequired: quiz.is_required },
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      points: q.points,
      position: q.position,
      choices: q.choices.map((c) => ({
        id: c.id,
        text: c.text,
        position: c.position,
        ...(includeCorrect ? { isCorrect: c.is_correct } : {}),
      })),
    })),
  };
}

/** Order-independent set equality, robust to accidental duplicate ids in either list. */
function sameChoiceSet(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const id of setA) {
    if (!setB.has(id)) return false;
  }
  return true;
}

function generateCertificateNo(): string {
  const year = new Date().getFullYear();
  const hex = randomBytes(4).toString('hex').toUpperCase();
  return `CERT-${year}-${hex}`;
}

/**
 * Validate + shape the authoring payload into the repository's question tree.
 * Zod only checks structural shape; the semantic rules (choice counts,
 * correct-answer counts per question type) live here, shared by the course
 * final quiz and per-lesson quizzes.
 */
function shapeQuestionTreeInput(input: UpsertQuizInput): QuizTreeQuestionInput[] {
  if (input.questions.length === 0) {
    throw new AppError('At least one question is required', 400);
  }

  return input.questions.map((q, qIndex) => {
    if (q.choices.length < 2) {
      throw new AppError(`Question ${qIndex + 1} must have at least 2 choices`, 400);
    }
    const correctCount = q.choices.filter((c) => c.isCorrect).length;
    if (q.type === 'single' && correctCount !== 1) {
      throw new AppError(`Question ${qIndex + 1} (single-answer) must have exactly 1 correct choice`, 400);
    }
    if (q.type === 'multiple' && correctCount < 1) {
      throw new AppError(`Question ${qIndex + 1} (multi-answer) must have at least 1 correct choice`, 400);
    }

    return {
      text: q.text,
      type: q.type,
      points: q.points ?? 1,
      position: qIndex,
      choices: q.choices.map((c, cIndex) => ({ text: c.text, is_correct: c.isCorrect, position: cIndex })),
    };
  });
}

/** Server-side grading, shared by final-quiz and lesson-quiz submissions. */
function gradeAnswers(
  quizData: QuizWithQuestions,
  input: SubmitQuizInput,
): { scorePct: number; results: QuizAttemptQuestionResult[]; snapshot: unknown[] } {
  const answersByQuestion = new Map(input.answers.map((a) => [a.questionId, a.choiceIds]));

  let earned = 0;
  let total = 0;
  const results: QuizAttemptQuestionResult[] = [];
  const snapshot: unknown[] = [];

  for (const question of quizData.questions) {
    const correctChoiceIds = question.choices.filter((c) => c.is_correct).map((c) => c.id);
    const selectedChoiceIds = answersByQuestion.get(question.id) ?? [];
    const correct = sameChoiceSet(correctChoiceIds, selectedChoiceIds);

    total += question.points;
    if (correct) earned += question.points;

    results.push({ questionId: question.id, correct, correctChoiceIds, selectedChoiceIds });

    snapshot.push({
      questionId: question.id,
      text: question.text,
      type: question.type,
      points: question.points,
      choices: question.choices.map((c) => ({ id: c.id, text: c.text, isCorrect: c.is_correct })),
      selectedChoiceIds,
      correct,
    });
  }

  return { scorePct: total > 0 ? Math.round((earned / total) * 100) : 0, results, snapshot };
}

/** 404 (not 400) for a bad lesson id, matching the module's not-found pattern. */
async function requireLesson(lessonId: string): Promise<TrainingLesson> {
  const lesson = await trainingLessonRepository.findLessonById(lessonId);
  if (!lesson) throw new AppError('Lesson not found', 404);
  return lesson;
}

export const trainingQuizService = {
  /**
   * Full replace-upsert of a course's quiz (authoring, `platform_admin`
   * only). Validates question/choice shape server-side (Zod only checks
   * structural shape) before writing the transaction.
   */
  async upsertQuiz(courseId: string, input: UpsertQuizInput, scope: ScopeOrTrusted): Promise<QuizView> {
    await trainingService.assertCourseEditable(courseId, scope);

    const { quiz, questions: savedQuestions } = await trainingQuizRepository.upsertQuizTree(
      { courseId, lessonId: null, sectionId: null },
      // is_required is a lesson/section-quiz concept — the final quiz's
      // "requiredness" is already expressed by course completion, so it stays false here.
      { title: input.title ?? null, shuffle_questions: input.shuffleQuestions ?? false, is_required: false },
      shapeQuestionTreeInput(input),
    );

    return shapeQuizView(quiz, savedQuestions, true);
  },

  /**
   * Full replace-upsert of a LESSON's quiz (authoring, `platform_admin`
   * only) — same validation and tree shape as the course final quiz, keyed
   * by lesson instead.
   */
  async upsertLessonQuiz(lessonId: string, input: UpsertQuizInput, scope: ScopeOrTrusted): Promise<QuizView> {
    const lesson = await requireLesson(lessonId);
    await trainingService.assertCourseEditable(lesson.course_id, scope);

    const { quiz, questions: savedQuestions } = await trainingQuizRepository.upsertQuizTree(
      { courseId: lesson.course_id, lessonId: lesson.id, sectionId: null },
      {
        title: input.title ?? null,
        shuffle_questions: input.shuffleQuestions ?? false,
        is_required: input.isRequired ?? false,
      },
      shapeQuestionTreeInput(input),
    );

    return shapeQuizView(quiz, savedQuestions, true);
  },

  /**
   * Full replace-upsert of a SECTION's quiz (authoring, `platform_admin`
   * only) — same validation and tree shape, keyed by section.
   */
  async upsertSectionQuiz(sectionId: string, input: UpsertQuizInput, scope: ScopeOrTrusted): Promise<QuizView> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.assertCourseEditable(section.course_id, scope);

    const { quiz, questions: savedQuestions } = await trainingQuizRepository.upsertQuizTree(
      { courseId: section.course_id, lessonId: null, sectionId: section.id },
      {
        title: input.title ?? null,
        shuffle_questions: input.shuffleQuestions ?? false,
        is_required: input.isRequired ?? false,
      },
      shapeQuestionTreeInput(input),
    );

    return shapeQuizView(quiz, savedQuestions, true);
  },

  /**
   * Role-aware read: `platform_admin` (authoring context) gets `is_correct`
   * on every choice for the builder; any other staff (learner) only ever
   * sees it once the course is published + visible (404 otherwise, same
   * 404-as-permission pattern as `trainingService.getCourse`), and never
   * with `is_correct` attached. `quiz: null` (empty questions) means the
   * course has no quiz yet.
   */
  async getQuiz(courseId: string, scope: ScopeOrTrusted): Promise<QuizView> {
    await trainingService.getCourse(courseId, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestions(courseId);
    if (!quizData) return { quiz: null, questions: [] };

    return shapeQuizView(quizData.quiz, quizData.questions, isAdminContext(scope));
  },

  /** Role-aware read of a LESSON's quiz — same gating as `getQuiz`, via the lesson's course. */
  async getLessonQuiz(lessonId: string, scope: ScopeOrTrusted): Promise<QuizView> {
    const lesson = await requireLesson(lessonId);
    await trainingService.getCourse(lesson.course_id, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestionsByLessonId(lessonId);
    if (!quizData) return { quiz: null, questions: [] };

    return shapeQuizView(quizData.quiz, quizData.questions, isAdminContext(scope));
  },

  /** Role-aware read of a SECTION's quiz — same gating as `getQuiz`, via the section's course. */
  async getSectionQuiz(sectionId: string, scope: ScopeOrTrusted): Promise<QuizView> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.getCourse(section.course_id, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestionsBySectionId(sectionId);
    if (!quizData) return { quiz: null, questions: [] };

    return shapeQuizView(quizData.quiz, quizData.questions, isAdminContext(scope));
  },

  /**
   * Submit + server-side-grade a quiz attempt. Unlimited retakes; on
   * pass + content-complete, idempotently completes the enrollment and
   * issues a certificate.
   */
  async submitAttempt(courseId: string, input: SubmitQuizInput, scope: Scope): Promise<QuizAttemptResult> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);

    const course = await trainingService.getCourse(courseId, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestions(courseId);
    if (!quizData || quizData.questions.length === 0) {
      throw new AppError('This course has no quiz', 400);
    }

    const { enrollment } = await trainingProgressRepository.findOrCreateEnrollment({
      course_id: courseId,
      user_id: scope.userId,
      // orgId can be an empty string for users without an org context; the
      // org_id column is a uuid, so coalesce '' → null (else Postgres 22P02).
      org_id: scope.orgId || null,
      status: 'in_progress',
    });

    const contentComplete = await getContentComplete(courseId, enrollment.id);
    if (course.require_content_before_quiz && !contentComplete) {
      throw new AppError('Finish all required lessons first', 400);
    }

    const { scorePct, results, snapshot } = gradeAnswers(quizData, input);
    const passed = scorePct >= course.passing_score;
    const attemptNumber = (await trainingQuizRepository.getMaxAttemptNumber(enrollment.id, quizData.quiz.id)) + 1;

    await trainingQuizRepository.createAttempt({
      enrollment_id: enrollment.id,
      quiz_id: quizData.quiz.id,
      user_id: scope.userId,
      attempt_number: attemptNumber,
      score_pct: scorePct,
      passed,
      answers_snapshot: snapshot,
      submitted_at: new Date(),
    });

    let courseCompleted = false;
    let certificate: QuizCertificateView | null = null;

    if (passed && contentComplete) {
      courseCompleted = true;
      if (enrollment.status !== 'completed') {
        await trainingProgressRepository.markCompleted(enrollment.id);
      }

      const cert = await trainingQuizRepository.createCertificateIfNotExists({
        enrollment_id: enrollment.id,
        user_id: scope.userId,
        course_id: courseId,
        org_id: scope.orgId || null,
        score_pct: scorePct,
        certificate_no: generateCertificateNo(),
      });
      certificate = { certificate_no: cert.certificate_no, issued_at: cert.issued_at };
    }

    return {
      attemptNumber,
      scorePct,
      passed,
      passingScore: course.passing_score,
      courseCompleted,
      certificate,
      results,
    };
  },

  /**
   * Submit + server-side-grade a LESSON quiz attempt. Unlimited retakes and
   * no content gating (the quiz belongs to the lesson being studied). Passing
   * marks the lesson's progress complete — it never completes the course or
   * issues a certificate; that stays with the course final quiz.
   */
  async submitLessonAttempt(lessonId: string, input: SubmitQuizInput, scope: Scope): Promise<QuizAttemptResult> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);

    const lesson = await requireLesson(lessonId);
    const course = await trainingService.getCourse(lesson.course_id, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestionsByLessonId(lessonId);
    if (!quizData || quizData.questions.length === 0) {
      throw new AppError('This lesson has no quiz', 400);
    }

    const { enrollment } = await trainingProgressRepository.findOrCreateEnrollment({
      course_id: lesson.course_id,
      user_id: scope.userId,
      // '' → null: org_id is a uuid column (see submitAttempt above).
      org_id: scope.orgId || null,
      status: 'in_progress',
    });

    // Sequential progression: the lesson (and thus its quiz) must be unlocked.
    await assertLessonUnlocked(lesson, enrollment.id);

    const { scorePct, results, snapshot } = gradeAnswers(quizData, input);
    const passed = scorePct >= course.passing_score;
    const attemptNumber = (await trainingQuizRepository.getMaxAttemptNumber(enrollment.id, quizData.quiz.id)) + 1;

    await trainingQuizRepository.createAttempt({
      enrollment_id: enrollment.id,
      quiz_id: quizData.quiz.id,
      user_id: scope.userId,
      attempt_number: attemptNumber,
      score_pct: scorePct,
      passed,
      answers_snapshot: snapshot,
      submitted_at: new Date(),
    });

    if (passed) {
      await trainingProgressRepository.upsertProgress(enrollment.id, lessonId, { completed: true });
    }

    return {
      attemptNumber,
      scorePct,
      passed,
      passingScore: course.passing_score,
      courseCompleted: false,
      certificate: null,
      lessonCompleted: passed,
      results,
    };
  },

  /**
   * Submit + server-side-grade a SECTION quiz attempt. Unlimited retakes.
   * The section's lessons (and everything before the section) must be done
   * first — passing a REQUIRED section quiz is part of content completion,
   * but it never completes the course or issues a certificate; that stays
   * with the course final quiz.
   */
  async submitSectionAttempt(sectionId: string, input: SubmitQuizInput, scope: Scope): Promise<QuizAttemptResult> {
    if (!scope.userId) throw new AppError('User not found in scope', 401);

    const section = await getSectionOrThrow(sectionId);
    const course = await trainingService.getCourse(section.course_id, scope);

    const quizData = await trainingQuizRepository.findQuizWithQuestionsBySectionId(sectionId);
    if (!quizData || quizData.questions.length === 0) {
      throw new AppError('This section has no quiz', 400);
    }

    const { enrollment } = await trainingProgressRepository.findOrCreateEnrollment({
      course_id: section.course_id,
      user_id: scope.userId,
      // '' → null: org_id is a uuid column (see submitAttempt above).
      org_id: scope.orgId || null,
      status: 'in_progress',
    });

    // Sequential progression: everything before + this section's lessons first.
    await assertSectionQuizUnlocked(section, enrollment.id);

    const { scorePct, results, snapshot } = gradeAnswers(quizData, input);
    const passed = scorePct >= course.passing_score;
    const attemptNumber = (await trainingQuizRepository.getMaxAttemptNumber(enrollment.id, quizData.quiz.id)) + 1;

    await trainingQuizRepository.createAttempt({
      enrollment_id: enrollment.id,
      quiz_id: quizData.quiz.id,
      user_id: scope.userId,
      attempt_number: attemptNumber,
      score_pct: scorePct,
      passed,
      answers_snapshot: snapshot,
      submitted_at: new Date(),
    });

    return {
      attemptNumber,
      scorePct,
      passed,
      passingScore: course.passing_score,
      courseCompleted: false,
      certificate: null,
      results,
    };
  },
};
