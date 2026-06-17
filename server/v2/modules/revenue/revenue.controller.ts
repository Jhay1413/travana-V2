import { Request, Response } from "express";
import { revenueService } from "./revenue.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

export const revenueController = {
  getDashboard: asyncHandler(async (req: Request, res: Response) => {
    const data = await revenueService.getRevenueDashboard(getScope(req));
    return successResponse(res, data, "Revenue dashboard data retrieved successfully");
  }),

  getMonthBookings: asyncHandler(async (req: Request, res: Response) => {
    const yearParam = Array.isArray((req.params.year as string)) ? (req.params.year as string)[0] : (req.params.year as string);
    const monthParam = Array.isArray((req.params.month as string)) ? (req.params.month as string)[0] : (req.params.month as string);

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Invalid year or month parameter" });
    }

    const data = await revenueService.getMonthBookings(year, month, getScope(req));
    return successResponse(res, data, "Month bookings retrieved successfully");
  }),

  getMonthForwards: asyncHandler(async (req: Request, res: Response) => {
    const yearParam = Array.isArray((req.params.year as string)) ? (req.params.year as string)[0] : (req.params.year as string);
    const monthParam = Array.isArray((req.params.month as string)) ? (req.params.month as string)[0] : (req.params.month as string);

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Invalid year or month parameter" });
    }

    const data = await revenueService.getMonthForwards(year, month, getScope(req));
    return successResponse(res, data, "Month forwards retrieved successfully");
  }),

  regenerateForwards: asyncHandler(async (req: Request, res: Response) => {
    const data = await revenueService.regenerateForwardsReport(getScope(req));
    return successResponse(res, data, "Forwards report regenerated successfully");
  }),
};
