import { Request, Response } from "express";
import { commissionService } from "../services/commission.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const commissionController = {
  getByQuoteId: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const commission = await commissionService.getByQuoteId(quoteId);
    return successResponse(res, commission, "Commission retrieved successfully");
  }),

  createCommission: asyncHandler(async (req: Request, res: Response) => {
    const commission = await commissionService.createCommission(req.body);
    return successResponse(res, commission, "Commission created successfully", 201);
  }),

  updateCommission: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const commission = await commissionService.updateCommission(id, req.body);
    return successResponse(res, commission, "Commission updated successfully");
  }),
};
