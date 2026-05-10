import { Request, Response } from "express";
import { dashboardService } from "./dashboard.service";
import { userRepository } from "../user/user.repository";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";

export const dashboardController = {
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await dashboardService.getStats(getScope(req));
    return successResponse(res, stats, "Dashboard stats retrieved successfully");
  }),

  getMyProfit: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const data = await dashboardService.getMyProfit(userId);
    return successResponse(res, data, "My profit retrieved successfully");
  }),

  getAgentStats: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const data = await dashboardService.getAgentStats(userId);
    return successResponse(res, data, "Agent stats retrieved successfully");
  }),

  getAdminOverviewStats: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const dbUser = await userRepository.findRoleById(userId);
    if (!dbUser || (dbUser.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const data = await dashboardService.getAdminOverviewStats(getScope(req));
    return successResponse(res, data, "Admin overview stats retrieved successfully");
  }),
};
