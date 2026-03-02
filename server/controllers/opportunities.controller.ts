import { Request, Response } from "express";
import { opportunitiesService } from "../services/opportunities.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { getUserId } from "../utils/get-user-id";

function resolveAgentId(req: Request): string | undefined {
  const queryAgentId = req.query.agentId as string;
  if (queryAgentId) return queryAgentId;
  return undefined;
}

export const opportunitiesController = {
  getEnquiries: asyncHandler(async (req: Request, res: Response) => {
    const result = await opportunitiesService.getEnquiries({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      search: req.query.search as string,
      dateRange: req.query.dateRange as string,
      agentId: resolveAgentId(req),
      sortBy: req.query.sortBy as string,
    });
    return successResponse(res, result, "Enquiries retrieved");
  }),

  getQuotes: asyncHandler(async (req: Request, res: Response) => {
    const result = await opportunitiesService.getQuotes({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      search: req.query.search as string,
      dateRange: req.query.dateRange as string,
      agentId: resolveAgentId(req),
      sortBy: req.query.sortBy as string,
    });
    return successResponse(res, result, "Quotes retrieved");
  }),

  getBookings: asyncHandler(async (req: Request, res: Response) => {
    const result = await opportunitiesService.getBookings({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      search: req.query.search as string,
      dateRange: req.query.dateRange as string,
      agentId: resolveAgentId(req),
      sortBy: req.query.sortBy as string,
    });
    return successResponse(res, result, "Bookings retrieved");
  }),

  getAgents: asyncHandler(async (_req: Request, res: Response) => {
    const agents = await opportunitiesService.getAgents();
    return successResponse(res, agents, "Agents retrieved");
  }),
};
