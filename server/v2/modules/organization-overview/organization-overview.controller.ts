import { Request, Response } from "express";
import { organizationOverviewService } from "./organization-overview.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

const ALLOWED_RANGES = new Set(["day", "week", "month", "custom"] as const);

export const organizationOverviewController = {
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationOverviewService.getStats(getScope(req));
    return successResponse(res, data, "Organization overview retrieved successfully");
  }),

  getAgentsPerformance: asyncHandler(async (req: Request, res: Response) => {
    const rawRange = String((req.query.range as string) ?? "month").toLowerCase();
    const range = (ALLOWED_RANGES.has(rawRange as never) ? rawRange : "month") as
      | "day"
      | "week"
      | "month"
      | "custom";
    const from = (req.query.from as string) ? new Date(String((req.query.from as string))) : undefined;
    const to = (req.query.to as string) ? new Date(String((req.query.to as string))) : undefined;
    const safeFrom = from && !Number.isNaN(from.getTime()) ? from : undefined;
    const safeTo = to && !Number.isNaN(to.getTime()) ? to : undefined;
    const data = await organizationOverviewService.getAgentsPerformance(
      getScope(req),
      range,
      safeFrom,
      safeTo,
    );
    return successResponse(res, data, "Agents performance retrieved successfully");
  }),

  getBranchesPerformance: asyncHandler(async (req: Request, res: Response) => {
    const rawRange = String((req.query.range as string) ?? "month").toLowerCase();
    const range = (ALLOWED_RANGES.has(rawRange as never) ? rawRange : "month") as
      | "day"
      | "week"
      | "month"
      | "custom";
    const from = (req.query.from as string) ? new Date(String((req.query.from as string))) : undefined;
    const to = (req.query.to as string) ? new Date(String((req.query.to as string))) : undefined;
    const safeFrom = from && !Number.isNaN(from.getTime()) ? from : undefined;
    const safeTo = to && !Number.isNaN(to.getTime()) ? to : undefined;
    const data = await organizationOverviewService.getBranchesPerformance(
      getScope(req),
      range,
      safeFrom,
      safeTo,
    );
    return successResponse(res, data, "Branches performance retrieved successfully");
  }),
};
