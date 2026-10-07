import { Request, Response } from 'express';
import { trainingUploadService } from './training-upload.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const trainingUploadController = {
  presign: asyncHandler(async (req: Request, res: Response) => {
    const result = await trainingUploadService.presignUpload(req.body, getScope(req));
    return successResponse(res, result, 'Upload URL generated successfully');
  }),
};
