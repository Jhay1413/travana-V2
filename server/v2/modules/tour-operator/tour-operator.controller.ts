import { Request, Response } from 'express';
import { tourOperatorService } from './tour-operator.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const tourOperatorController = {
  listTourOperators: asyncHandler(async (_req: Request, res: Response) => {
    const tourOperators = await tourOperatorService.listTourOperators();
    return successResponse(res, tourOperators, 'Tour operators retrieved successfully');
  }),

  getTourOperatorById: asyncHandler(async (req: Request, res: Response) => {
    const tourOperator = await tourOperatorService.getTourOperatorById(req.params.id);
    return successResponse(res, tourOperator, 'Tour operator retrieved successfully');
  }),

  createTourOperator: asyncHandler(async (req: Request, res: Response) => {
    const tourOperator = await tourOperatorService.createTourOperator(req.body);
    return successResponse(res, tourOperator, 'Tour operator created successfully', 201);
  }),

  updateTourOperator: asyncHandler(async (req: Request, res: Response) => {
    const tourOperator = await tourOperatorService.updateTourOperator(req.params.id, req.body);
    return successResponse(res, tourOperator, 'Tour operator updated successfully');
  }),

  deleteTourOperator: asyncHandler(async (req: Request, res: Response) => {
    await tourOperatorService.deleteTourOperator(req.params.id);
    res.status(204).send();
  }),
};
