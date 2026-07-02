import { Request, Response } from 'express';
import { trainingLessonService } from './training-lesson.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';
import { AppError } from '../../utils/error-handler';

export const trainingLessonController = {
  createLesson: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const lesson = await trainingLessonService.createLesson(courseId, req.body, scope);
    return successResponse(res, lesson, 'Lesson created successfully', 201);
  }),

  updateLesson: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const lesson = await trainingLessonService.updateLesson(id, req.body, scope);
    return successResponse(res, lesson, 'Lesson updated successfully');
  }),

  deleteLesson: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await trainingLessonService.deleteLesson(id, scope);
    return successResponse(res, null, 'Lesson deleted successfully');
  }),

  reorderLessons: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const lessons = await trainingLessonService.reorderLessons(courseId, req.body.order, scope);
    return successResponse(res, lessons, 'Lessons reordered successfully');
  }),

  addAssets: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const lessonId = req.params.id as string;
    const assets = await trainingLessonService.addAssetUrls(lessonId, req.body.assets, scope);
    return successResponse(res, assets, `${assets.length} asset(s) added successfully`, 201);
  }),

  uploadAssets: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const lessonId = req.params.id as string;
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new AppError('No files provided', 400);
    }
    const assets = await trainingLessonService.uploadAssets(lessonId, files, scope);
    return successResponse(res, assets, `${assets.length} asset(s) uploaded successfully`, 201);
  }),

  deleteAsset: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await trainingLessonService.deleteAsset(id, scope);
    return successResponse(res, null, 'Asset deleted successfully');
  }),
};
