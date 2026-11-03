import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";
import { successResponse } from "../../utils/response";
import { agentProfileService } from "./agent-profile.service";
import { agentProfileActivityService } from "./agent-profile.activity.service";
import type { BiggestDealsQuery, MonthlyQuery, PerformanceQuery, WeekQuery } from "./agent-profile.validator";

function subjectId(req: Request): string {
  return String(req.params.userId).trim();
}

export const agentProfileController = {
  getHeader: asyncHandler(async (req: Request, res: Response) => {
    const data = await agentProfileService.getHeader(getScope(req), subjectId(req));
    return successResponse(res, data, "Agent profile retrieved successfully");
  }),

  getPerformance: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as unknown as PerformanceQuery;
    const data = await agentProfileService.getPerformance(getScope(req), subjectId(req), from, to);
    return successResponse(res, data, "Agent performance retrieved successfully");
  }),

  getWeek: asyncHandler(async (req: Request, res: Response) => {
    const { start } = req.query as unknown as WeekQuery;
    const data = await agentProfileActivityService.getWeek(getScope(req), subjectId(req), start);
    return successResponse(res, data, "Agent week retrieved successfully");
  }),

  getMonthly: asyncHandler(async (req: Request, res: Response) => {
    // validate() does not write parsed values back, so convert here.
    const { year } = req.query as unknown as MonthlyQuery;
    const data = await agentProfileService.getMonthly(getScope(req), subjectId(req), year === undefined ? undefined : Number(year));
    return successResponse(res, data, "Agent monthly profit retrieved successfully");
  }),

  getBiggestDeals: asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as unknown as BiggestDealsQuery;
    const data = await agentProfileService.getBiggestDeals(getScope(req), subjectId(req), limit === undefined ? undefined : Number(limit));
    return successResponse(res, data, "Agent biggest deals retrieved successfully");
  }),

  getTraining: asyncHandler(async (req: Request, res: Response) => {
    const data = await agentProfileActivityService.getTraining(getScope(req), subjectId(req));
    return successResponse(res, data, "Agent training retrieved successfully");
  }),

  getPayouts: asyncHandler(async (req: Request, res: Response) => {
    const data = await agentProfileActivityService.getPayouts(getScope(req), subjectId(req));
    return successResponse(res, data, "Agent payouts retrieved successfully");
  }),
};
