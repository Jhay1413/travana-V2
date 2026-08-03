import { z } from 'zod';

const quizChoiceBody = z.object({
  text: z.string().min(1, 'Choice text is required'),
  isCorrect: z.boolean(),
});

const quizQuestionBody = z.object({
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['single', 'multiple']),
  points: z.number().int().min(1).optional(),
  choices: z.array(quizChoiceBody).min(2, 'Each question needs at least 2 choices'),
});

export const upsertQuizValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
  body: z.object({
    title: z.string().nullable().optional(),
    shuffleQuestions: z.boolean().optional(),
    isRequired: z.boolean().optional(),
    questions: z.array(quizQuestionBody).min(1, 'At least one question is required'),
  }),
});

export const quizCourseIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
});

const attemptBody = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid('Invalid question id'),
      choiceIds: z.array(z.string().uuid('Invalid choice id')),
    }),
  ),
});

export const submitQuizAttemptValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
  body: attemptBody,
});

// Lesson-quiz variants: same bodies, the :id param is a lesson id instead.
export const upsertLessonQuizValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
  body: upsertQuizValidator.shape.body,
});

export const quizLessonIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
});

export const submitLessonQuizAttemptValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
  body: attemptBody,
});

// Section-quiz variants: same bodies, the :id param is a section id instead.
export const upsertSectionQuizValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
  body: upsertQuizValidator.shape.body,
});

export const quizSectionIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
});

export const submitSectionQuizAttemptValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
  body: attemptBody,
});

export type UpsertQuizBody = z.infer<typeof upsertQuizValidator>['body'];
export type SubmitQuizAttemptBody = z.infer<typeof submitQuizAttemptValidator>['body'];
