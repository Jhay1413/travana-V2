import { Request, Response } from 'express';
import { trainingQuizService } from './training-quiz.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const trainingQuizController = {
  // Authoring (platform_admin): full replace-upsert of the course's quiz.
  upsertQuiz: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const quiz = await trainingQuizService.upsertQuiz(courseId, req.body, scope);
    return successResponse(res, quiz, 'Quiz saved successfully');
  }),

  // Role-aware: admin gets is_correct (builder), learners never do.
  getQuiz: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const quiz = await trainingQuizService.getQuiz(courseId, scope);
    return successResponse(res, quiz, 'Quiz retrieved successfully');
  }),

  // Learner: submit answers, graded server-side.
  submitAttempt: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const result = await trainingQuizService.submitAttempt(courseId, req.body, scope);
    return successResponse(res, result, 'Attempt submitted successfully', 201);
  }),

  // Authoring (platform_admin): full replace-upsert of a LESSON's quiz.
  upsertLessonQuiz: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const lessonId = req.params.id as string;
    const quiz = await trainingQuizService.upsertLessonQuiz(lessonId, req.body, scope);
    return successResponse(res, quiz, 'Lesson quiz saved successfully');
  }),

  // Role-aware: admin gets is_correct (builder), learners never do.
  getLessonQuiz: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const lessonId = req.params.id as string;
    const quiz = await trainingQuizService.getLessonQuiz(lessonId, scope);
    return successResponse(res, quiz, 'Lesson quiz retrieved successfully');
  }),

  // Learner: submit lesson-quiz answers; passing marks the lesson complete.
  submitLessonAttempt: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const lessonId = req.params.id as string;
    const result = await trainingQuizService.submitLessonAttempt(lessonId, req.body, scope);
    return successResponse(res, result, 'Attempt submitted successfully', 201);
  }),
};
