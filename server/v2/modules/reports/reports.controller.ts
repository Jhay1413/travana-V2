import { Request, Response } from "express";
import { reportsService } from "./reports.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

function readString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return undefined;
}

export const reportsController = {
  getSales: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportsService.getSales(getScope(req), {
      from: readString(req.query.from),
      to: readString(req.query.to),
      branchId: readString(req.query.branchId),
      agentId: readString(req.query.agentId),
      leadSource: readString(req.query.leadSource),
    });
    return successResponse(res, data, "Sales report retrieved");
  }),

  getAgents: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportsService.getAgentPerformance(getScope(req), {
      from: readString(req.query.from),
      to: readString(req.query.to),
      branchId: readString(req.query.branchId),
      leadSource: readString(req.query.leadSource),
    });
    return successResponse(res, data, "Agent performance report retrieved");
  }),

  getLeadSource: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportsService.getLeadSource(getScope(req), {
      from: readString(req.query.from),
      to: readString(req.query.to),
      branchId: readString(req.query.branchId),
    });
    return successResponse(res, data, "Lead source report retrieved");
  }),

  getTargetsVsActuals: asyncHandler(async (req: Request, res: Response) => {
    const yearStr = readString(req.query.year);
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    const data = await reportsService.getTargetsVsActuals(
      getScope(req),
      year,
      readString(req.query.branchId),
    );
    return successResponse(res, data, "Targets vs actuals report retrieved");
  }),
};
