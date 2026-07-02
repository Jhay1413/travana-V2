import { Request, Response } from 'express';
import { trainingUploadService } from './training-upload.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const trainingUploadController = {
  presign: asyncHandler(async (req: Request, res: Response) => {
    const result = await trainingUploadService.presignVideoUpload(req.body);
    return successResponse(res, result, 'Upload URL generated successfully');
  }),
};
