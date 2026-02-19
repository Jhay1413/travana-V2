import { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const dashboardController = {
  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await dashboardService.getStats();
    return successResponse(res, stats, "Dashboard stats retrieved successfully");
  }),
};
