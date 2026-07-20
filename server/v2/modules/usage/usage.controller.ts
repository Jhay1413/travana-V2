import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { usageService } from "./usage.service";

export const usageController = {
  // GET /api/v2/usage/summary — current-period AI + SendSeven usage vs limits.
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    const data = await usageService.getOrgUsageSummary(orgId);
    return successResponse(res, data, "Usage summary retrieved");
  }),

  // GET /api/v2/usage/history?months=6
  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    const months = Number((req.query.months as string | undefined) ?? 6);
    const data = await usageService.getOrgUsageHistory(orgId, months);
    return successResponse(res, data, "Usage history retrieved");
  }),
};
