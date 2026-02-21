import { Request, Response } from "express";
import { socialPostService } from "../services/social-post.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const socialPostController = {
  generatePost: asyncHandler(async (req: Request, res: Response) => {
    const deal = await socialPostService.generatePost(req.body);
    return successResponse(res, deal, "Post generated successfully", 201);
  }),

  getByQuoteId: asyncHandler(async (req: Request, res: Response) => {
    const { quoteId } = req.params;
    const deal = await socialPostService.getTravelDealByQuoteId(quoteId);
    return successResponse(res, deal, "Travel deal retrieved successfully");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deal = await socialPostService.updateTravelDeal(id, req.body);
    return successResponse(res, deal, "Travel deal updated successfully");
  }),
};
