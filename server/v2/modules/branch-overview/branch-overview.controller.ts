import { Request, Response } from "express";
import { branchOverviewService } from "./branch-overview.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

const ALLOWED_RANGES = new Set(["day", "week", "month", "custom"] as const);

export const branchOverviewController = {
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const data = await branchOverviewService.getStats(getScope(req));
    return successResponse(res, data, "Branch overview retrieved successfully");
  }),

  getAgentsPerformance: asyncHandler(async (req: Request, res: Response) => {
    const rawRange = String(req.query.range ?? "month").toLowerCase();
    const range = (ALLOWED_RANGES.has(rawRange as never) ? rawRange : "month") as
      | "day"
      | "week"
      | "month"
      | "custom";
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const safeFrom = from && !Number.isNaN(from.getTime()) ? from : undefined;
    const safeTo = to && !Number.isNaN(to.getTime()) ? to : undefined;
    const data = await branchOverviewService.getAgentsPerformance(
      getScope(req),
      range,
      safeFrom,
      safeTo,
    );
    return successResponse(res, data, "Agents performance retrieved successfully");
  }),
};
