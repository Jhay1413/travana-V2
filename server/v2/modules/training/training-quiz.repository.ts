import { db } from '../../config/database';
import {
  training_quiz,
  training_question,
  training_choice,
  training_quiz_attempt,
  training_certificate,
} from '@shared/schema';
import type {
  TrainingQuiz,
  TrainingQuestion,
  TrainingChoice,
  InsertTrainingChoice,
  TrainingQuizAttempt,
  InsertTrainingQuizAttempt,
  TrainingCertificate,
  InsertTrainingCertificate,
} from '@shared/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

export interface QuizQuestionWithChoices extends TrainingQuestion {
  choices: TrainingChoice[];
}

export interface QuizWithQuestions {
  quiz: TrainingQuiz;
  questions: QuizQuestionWithChoices[];
}

/** Question/choice tree shape accepted by `upsertQuizTree`, already resolved to snake_case columns. */
export interface QuizTreeQuestionInput {
  text: string;
  type: TrainingQuestion['type'];
  points: number;
  position: number;
  choices: { text: string; is_correct: boolean; position: number }[];
}

export const trainingQuizRepository = {
  async findQuizByCourseId(courseId: string): Promise<TrainingQuiz | undefined> {
    const [row] = await db.select().from(training_quiz).where(eq(training_quiz.course_id, courseId)).limit(1);
    return row;
  },

  /** Full quiz tree (quiz + ordered questions, each with its ordered choices) for a course. */
  async findQuizWithQuestions(courseId: string): Promise<QuizWithQuestions | undefined> {
    const quiz = await this.findQuizByCourseId(courseId);
    if (!quiz) return undefined;

    const questions = await db
      .select()
      .from(training_question)
      .where(eq(training_question.quiz_id, quiz.id))
      .orderBy(asc(training_question.position));

    const questionIds = questions.map((q) => q.id);
    const choices =
      questionIds.length > 0
        ? await db
            .select()
            .from(training_choice)
            .where(inArray(training_choice.question_id, questionIds))
            .orderBy(asc(training_choice.position))
        : [];

    const choicesByQuestion = new Map<string, TrainingChoice[]>();
    for (const choice of choices) {
      const list = choicesByQuestion.get(choice.question_id) ?? [];
      list.push(choice);
      choicesByQuestion.set(choice.question_id, list);
    }

    return {
      quiz,
      questions: questions.map((q) => ({ ...q, choices: choicesByQuestion.get(q.id) ?? [] })),
    };
  },

  /**
   * Full replace-upsert in one transaction: upsert the `training_quiz` row
   * (1:1 by `course_id`), delete its existing questions (cascades choices),
   * then insert the new question/choice tree from the payload. Safe for
   * historical attempts because they store an `answers_snapshot` and only FK
   * `quiz_id` — never a question/choice id.
   */
  async upsertQuizTree(
    courseId: string,
    quizPatch: { title: string | null; shuffle_questions: boolean },
    questions: QuizTreeQuestionInput[],
  ): Promise<QuizWithQuestions> {
    return db.transaction(async (tx) => {
      const [quiz] = await tx
        .insert(training_quiz)
        .values({ course_id: courseId, title: quizPatch.title, shuffle_questions: quizPatch.shuffle_questions })
        .onConflictDoUpdate({
          target: training_quiz.course_id,
          set: { title: quizPatch.title, shuffle_questions: quizPatch.shuffle_questions, updated_at: new Date() },
        })
        .returning();

      await tx.delete(training_question).where(eq(training_question.quiz_id, quiz.id));

      const savedQuestions: QuizQuestionWithChoices[] = [];
      for (const q of questions) {
        const [question] = await tx
          .insert(training_question)
          .values({ quiz_id: quiz.id, text: q.text, type: q.type, position: q.position, points: q.points })
          .returning();

        const choiceRows: InsertTrainingChoice[] = q.choices.map((c) => ({
          question_id: question.id,
          text: c.text,
          is_correct: c.is_correct,
          position: c.position,
        }));
        const choices = choiceRows.length > 0 ? await tx.insert(training_choice).values(choiceRows).returning() : [];

        savedQuestions.push({ ...question, choices });
      }

      return { quiz, questions: savedQuestions };
    });
  },

  async getMaxAttemptNumber(enrollmentId: string, quizId: string): Promise<number> {
    const [row] = await db
      .select({ maxAttempt: sql<number>`coalesce(max(${training_quiz_attempt.attempt_number}), 0)` })
      .from(training_quiz_attempt)
      .where(and(eq(training_quiz_attempt.enrollment_id, enrollmentId), eq(training_quiz_attempt.quiz_id, quizId)));
    return row?.maxAttempt ?? 0;
  },

  async createAttempt(data: InsertTrainingQuizAttempt): Promise<TrainingQuizAttempt> {
    const [row] = await db.insert(training_quiz_attempt).values(data).returning();
    return row;
  },

  async listAttemptsByEnrollmentAndQuiz(enrollmentId: string, quizId: string): Promise<TrainingQuizAttempt[]> {
    return db
      .select()
      .from(training_quiz_attempt)
      .where(and(eq(training_quiz_attempt.enrollment_id, enrollmentId), eq(training_quiz_attempt.quiz_id, quizId)))
      .orderBy(desc(training_quiz_attempt.attempt_number));
  },

  async findCertificateByEnrollmentId(enrollmentId: string): Promise<TrainingCertificate | undefined> {
    const [row] = await db
      .select()
      .from(training_certificate)
      .where(eq(training_certificate.enrollment_id, enrollmentId))
      .limit(1);
    return row;
  },

  /** Idempotent: relies on `unique(enrollment_id)` so concurrent submits never double-issue a certificate. */
  async createCertificateIfNotExists(data: InsertTrainingCertificate): Promise<TrainingCertificate> {
    const [inserted] = await db
      .insert(training_certificate)
      .values(data)
      .onConflictDoNothing({ target: training_certificate.enrollment_id })
      .returning();
    if (inserted) return inserted;

    const existing = await this.findCertificateByEnrollmentId(data.enrollment_id);
    if (!existing) {
      throw new Error(`Certificate upsert failed for enrollment ${data.enrollment_id}`);
    }
    return existing;
  },
};
