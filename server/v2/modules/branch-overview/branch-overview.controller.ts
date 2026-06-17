import { Request, Response } from "express";
import { branchOverviewService } from "./branch-overview.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

const ALLOWED_RANGES = new Set(["day", "week", "month", "custom"] as const);

function branchOverrideFrom(req: Request): string | undefined {
  const raw = (req.query.branchId as string);
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
}

export const branchOverviewController = {
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const data = await branchOverviewService.getStats(getScope(req), branchOverrideFrom(req));
    return successResponse(res, data, "Branch overview retrieved successfully");
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
    const data = await branchOverviewService.getAgentsPerformance(
      getScope(req),
      range,
      safeFrom,
      safeTo,
      branchOverrideFrom(req),
    );
    return successResponse(res, data, "Agents performance retrieved successfully");
  }),
};
