import { randomBytes } from 'crypto';
import { trainingQuizRepository, type QuizQuestionWithChoices } from './training-quiz.repository';
import { trainingProgressRepository } from './training-progress.repository';
import { getContentComplete } from './training-progress.service';
import { trainingService, isAdminContext } from './training.service';
import type { ScopeOrTrusted } from './training.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import type { TrainingQuiz } from '@shared/schema';
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
    quiz: { id: quiz.id, title: quiz.title, shuffleQuestions: quiz.shuffle_questions },
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

export const trainingQuizService = {
  /**
   * Full replace-upsert of a course's quiz (authoring, `platform_admin`
   * only). Validates question/choice shape server-side (Zod only checks
   * structural shape) before writing the transaction.
   */
  async upsertQuiz(courseId: string, input: UpsertQuizInput, scope: ScopeOrTrusted): Promise<QuizView> {
    await trainingService.assertCourseEditable(courseId, scope);

    if (input.questions.length === 0) {
      throw new AppError('At least one question is required', 400);
    }

    const questions = input.questions.map((q, qIndex) => {
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

    const { quiz, questions: savedQuestions } = await trainingQuizRepository.upsertQuizTree(
      courseId,
      { title: input.title ?? null, shuffle_questions: input.shuffleQuestions ?? false },
      questions,
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

    const scorePct = total > 0 ? Math.round((earned / total) * 100) : 0;
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
};
