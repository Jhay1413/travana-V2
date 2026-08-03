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
import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';

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

/** Ordered questions (each with its ordered choices) for a quiz row. */
async function loadQuestionTree(quizId: string): Promise<QuizQuestionWithChoices[]> {
  const questions = await db
    .select()
    .from(training_question)
    .where(eq(training_question.quiz_id, quizId))
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

  return questions.map((q) => ({ ...q, choices: choicesByQuestion.get(q.id) ?? [] }));
}

export const trainingQuizRepository = {
  /** The course-level "final" quiz row (`lesson_id` AND `section_id` NULL) — never a lesson/section quiz. */
  async findQuizByCourseId(courseId: string): Promise<TrainingQuiz | undefined> {
    const [row] = await db
      .select()
      .from(training_quiz)
      .where(
        and(
          eq(training_quiz.course_id, courseId),
          isNull(training_quiz.lesson_id),
          isNull(training_quiz.section_id),
        ),
      )
      .limit(1);
    return row;
  },

  async findQuizByLessonId(lessonId: string): Promise<TrainingQuiz | undefined> {
    const [row] = await db.select().from(training_quiz).where(eq(training_quiz.lesson_id, lessonId)).limit(1);
    return row;
  },

  async findQuizBySectionId(sectionId: string): Promise<TrainingQuiz | undefined> {
    const [row] = await db.select().from(training_quiz).where(eq(training_quiz.section_id, sectionId)).limit(1);
    return row;
  },

  /** All per-lesson quiz rows of a course (excludes section and final quizzes). */
  async listLessonQuizzesByCourseId(courseId: string): Promise<TrainingQuiz[]> {
    return db
      .select()
      .from(training_quiz)
      .where(and(eq(training_quiz.course_id, courseId), isNotNull(training_quiz.lesson_id)));
  },

  /** All per-section quiz rows of a course (excludes lesson and final quizzes). */
  async listSectionQuizzesByCourseId(courseId: string): Promise<TrainingQuiz[]> {
    return db
      .select()
      .from(training_quiz)
      .where(and(eq(training_quiz.course_id, courseId), isNotNull(training_quiz.section_id)));
  },

  /** Full final-quiz tree (quiz + ordered questions, each with its ordered choices) for a course. */
  async findQuizWithQuestions(courseId: string): Promise<QuizWithQuestions | undefined> {
    const quiz = await this.findQuizByCourseId(courseId);
    if (!quiz) return undefined;
    return { quiz, questions: await loadQuestionTree(quiz.id) };
  },

  /** Full quiz tree for a lesson's quiz. */
  async findQuizWithQuestionsByLessonId(lessonId: string): Promise<QuizWithQuestions | undefined> {
    const quiz = await this.findQuizByLessonId(lessonId);
    if (!quiz) return undefined;
    return { quiz, questions: await loadQuestionTree(quiz.id) };
  },

  /** Full quiz tree for a section's quiz. */
  async findQuizWithQuestionsBySectionId(sectionId: string): Promise<QuizWithQuestions | undefined> {
    const quiz = await this.findQuizBySectionId(sectionId);
    if (!quiz) return undefined;
    return { quiz, questions: await loadQuestionTree(quiz.id) };
  },

  /**
   * Full replace-upsert in one transaction: upsert the `training_quiz` row —
   * keyed by `lesson_id` (lesson quiz) or `section_id` (section quiz) when
   * set, else by `course_id` with both NULL (the course-level final quiz) —
   * delete its existing questions (cascades choices), then insert the new
   * question/choice tree from the payload. Safe for historical attempts
   * because they store an `answers_snapshot` and only FK `quiz_id` — never a
   * question/choice id.
   */
  async upsertQuizTree(
    target: { courseId: string; lessonId: string | null; sectionId: string | null },
    quizPatch: { title: string | null; shuffle_questions: boolean; is_required: boolean },
    questions: QuizTreeQuestionInput[],
  ): Promise<QuizWithQuestions> {
    return db.transaction(async (tx) => {
      const matchCond = target.lessonId
        ? eq(training_quiz.lesson_id, target.lessonId)
        : target.sectionId
          ? eq(training_quiz.section_id, target.sectionId)
          : and(
              eq(training_quiz.course_id, target.courseId),
              isNull(training_quiz.lesson_id),
              isNull(training_quiz.section_id),
            );

      const [existing] = await tx.select().from(training_quiz).where(matchCond).limit(1);

      let quiz: TrainingQuiz;
      if (existing) {
        [quiz] = await tx
          .update(training_quiz)
          .set({
            title: quizPatch.title,
            shuffle_questions: quizPatch.shuffle_questions,
            is_required: quizPatch.is_required,
            updated_at: new Date(),
          })
          .where(eq(training_quiz.id, existing.id))
          .returning();
      } else {
        [quiz] = await tx
          .insert(training_quiz)
          .values({
            course_id: target.courseId,
            lesson_id: target.lessonId,
            section_id: target.sectionId,
            title: quizPatch.title,
            shuffle_questions: quizPatch.shuffle_questions,
            is_required: quizPatch.is_required,
          })
          .returning();
      }

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

  /** Batch attempt fetch across several quizzes (e.g. every lesson quiz of a course) for one enrollment. */
  async listAttemptsByEnrollmentAndQuizIds(enrollmentId: string, quizIds: string[]): Promise<TrainingQuizAttempt[]> {
    if (quizIds.length === 0) return [];
    return db
      .select()
      .from(training_quiz_attempt)
      .where(and(eq(training_quiz_attempt.enrollment_id, enrollmentId), inArray(training_quiz_attempt.quiz_id, quizIds)))
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
