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

  getAdminOverviewStats: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { db } = await import("../config/database");
    const { user: userTable } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [dbUser] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, userId));
    if (!dbUser || dbUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const data = await dashboardService.getAdminOverviewStats();
    return successResponse(res, data, "Admin overview stats retrieved successfully");
  }),
};
