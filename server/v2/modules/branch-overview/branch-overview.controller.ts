import { Request, Response } from "express";
import { branchOverviewService } from "./branch-overview.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

export const branchOverviewController = {
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const data = await branchOverviewService.getStats(getScope(req));
    return successResponse(res, data, "Branch overview retrieved successfully");
  }),
};
