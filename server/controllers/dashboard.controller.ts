import { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { getUserId } from "../utils/get-user-id";

export const dashboardController = {
  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await dashboardService.getStats();
    return successResponse(res, stats, "Dashboard stats retrieved successfully");
  }),

  getMyProfit: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const data = await dashboardService.getMyProfit(userId);
    return successResponse(res, data, "My profit retrieved successfully");
  }),
};
