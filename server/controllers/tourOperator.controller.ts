import { Request, Response } from "express";
import { tourOperatorService } from "../services/tourOperator.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const tourOperatorController = {
  listTourOperators: asyncHandler(async (_req: Request, res: Response) => {
    const tourOperators = await tourOperatorService.listTourOperators();
    return successResponse(res, tourOperators, "Tour operators retrieved successfully");
  }),

  getTourOperatorById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const tourOperator = await tourOperatorService.getTourOperatorById(id);
    return successResponse(res, tourOperator, "Tour operator retrieved successfully");
  }),

  createTourOperator: asyncHandler(async (req: Request, res: Response) => {
    const tourOperator = await tourOperatorService.createTourOperator(req.body);
    return successResponse(res, tourOperator, "Tour operator created successfully", 201);
  }),

  updateTourOperator: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const tourOperator = await tourOperatorService.updateTourOperator(id, req.body);
    return successResponse(res, tourOperator, "Tour operator updated successfully");
  }),

  deleteTourOperator: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await tourOperatorService.deleteTourOperator(id);
    res.status(204).send();
  }),
};
