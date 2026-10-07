import { Request, Response } from "express";
import { imageUpscaleService } from "./image-upscale.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

export const imageUpscaleController = {
  createJob: asyncHandler(async (req: Request, res: Response) => {
    const { quoteId, imageUrl } = req.body as { quoteId?: string; imageUrl?: string };
    const job = await imageUpscaleService.createJob({ quoteId, imageUrl, file: req.file }, getScope(req));
    return successResponse(res, job, "Upscale job queued", 201);
  }),

  listJobs: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = String(req.query.quoteId);
    const jobs = await imageUpscaleService.listJobsForQuote(quoteId, getScope(req));
    return successResponse(res, jobs, "Upscale jobs retrieved successfully");
  }),

  listMine: asyncHandler(async (req: Request, res: Response) => {
    const jobs = await imageUpscaleService.listMyRecentJobs(getScope(req));
    return successResponse(res, jobs, "Upscale jobs retrieved successfully");
  }),

  getJob: asyncHandler(async (req: Request, res: Response) => {
    const job = await imageUpscaleService.getJob(String(req.params.id), getScope(req));
    return successResponse(res, job, "Upscale job retrieved successfully");
  }),

  revertJob: asyncHandler(async (req: Request, res: Response) => {
    const result = await imageUpscaleService.revertJob(String(req.params.id), getScope(req));
    return successResponse(res, result, "Upscale reverted");
  }),
};
