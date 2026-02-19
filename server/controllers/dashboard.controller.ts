import { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const dashboardController = {
  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await dashboardService.getStats();
    return successResponse(res, stats, "Dashboard stats retrieved successfully");
  }),

  getClientKPIs: asyncHandler(async (_req: Request, res: Response) => {
    const kpis = await dashboardService.getClientKPIs();
    return successResponse(res, kpis, "Client KPIs retrieved successfully");
  }),

  getRebooking: asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getRebookingDashboard();
    return successResponse(res, data, "Rebooking dashboard retrieved successfully");
  }),

  getVIP: asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getVIPDashboard();
    return successResponse(res, data, "VIP dashboard retrieved successfully");
  }),

  getBehaviour: asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getBehaviourDashboard();
    return successResponse(res, data, "Behaviour dashboard retrieved successfully");
  }),

  getClientList: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, sortBy, sortDir, search } = req.query;
    const data = await dashboardService.getClientList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy: sortBy as string | undefined,
      sortDir: sortDir as string | undefined,
      search: search as string | undefined,
    });
    return successResponse(res, data, "Client list retrieved successfully");
  }),
};
