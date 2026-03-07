import { Request, Response } from "express";
import { revenueService } from "../services/revenue.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const revenueController = {
  /**
   * GET /api/revenue/dashboard
   * Get complete revenue dashboard data
   */
  getDashboard: asyncHandler(async (_req: Request, res: Response) => {
    const data = await revenueService.getRevenueDashboard();
    return successResponse(res, data, "Revenue dashboard data retrieved successfully");
  }),

  /**
   * GET /api/revenue/month-bookings/:year/:month
   * Get detailed bookings for a specific month
   */
  getMonthBookings: asyncHandler(async (req: Request, res: Response) => {
    const yearParam = Array.isArray(req.params.year) ? req.params.year[0] : req.params.year;
    const monthParam = Array.isArray(req.params.month) ? req.params.month[0] : req.params.month;
    
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid year or month parameter",
      });
    }

    const data = await revenueService.getMonthBookings(year, month);
    return successResponse(res, data, "Month bookings retrieved successfully");
  }),

  /**
   * GET /api/revenue/month-forwards/:year/:month
   * Get forwards for a specific month
   */
  getMonthForwards: asyncHandler(async (req: Request, res: Response) => {
    const yearParam = Array.isArray(req.params.year) ? req.params.year[0] : req.params.year;
    const monthParam = Array.isArray(req.params.month) ? req.params.month[0] : req.params.month;
    
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid year or month parameter",
      });
    }

    const data = await revenueService.getMonthForwards(year, month);
    return successResponse(res, data, "Month forwards retrieved successfully");
  }),
};
