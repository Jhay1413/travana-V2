import { Request, Response } from "express";
import { socialPostService } from "./social-post.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";

export const socialPostController = {
  generatePost: asyncHandler(async (req: Request, res: Response) => {
    const deal = await socialPostService.generatePost(req.body);
    return successResponse(res, deal, "Post generated successfully", 201);
  }),

  getByQuoteId: asyncHandler(async (req: Request, res: Response) => {
    const { quoteId } = req.params as { quoteId: string };
    const deal = await socialPostService.getTravelDealByQuoteId(quoteId);
    return successResponse(res, deal, "Travel deal retrieved successfully");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const deal = await socialPostService.updateTravelDeal(id, req.body);
    return successResponse(res, deal, "Travel deal updated successfully");
  }),

  schedulePost: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const postSchedule = req.body.postSchedule as string;
    if (!postSchedule || isNaN(new Date(postSchedule).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid or missing postSchedule" });
    }
    let existingImageIds: number[] = [];
    let imageUrls: string[] = [];
    try { existingImageIds = JSON.parse(req.body.existingImageIds || "[]"); } catch { existingImageIds = []; }
    try { imageUrls = JSON.parse(req.body.imageUrls || "[]"); } catch { imageUrls = []; }
    const newFiles = (req.files as Express.Multer.File[]) || [];
    const deal = await socialPostService.schedulePost(id, postSchedule, existingImageIds, newFiles, imageUrls);
    return successResponse(res, deal, "Post scheduled successfully");
  }),

  reschedulePost: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const postSchedule = req.body.postSchedule as string;
    if (!postSchedule || isNaN(new Date(postSchedule).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid or missing postSchedule" });
    }
    const postContent = (req.body.postContent as string) || "";
    let existingImageIds: number[] = [];
    let imageUrls: string[] = [];
    try { existingImageIds = JSON.parse(req.body.existingImageIds || "[]"); } catch { existingImageIds = []; }
    try { imageUrls = JSON.parse(req.body.imageUrls || "[]"); } catch { imageUrls = []; }
    const newFiles = (req.files as Express.Multer.File[]) || [];
    const deal = await socialPostService.reschedulePost(id, postSchedule, existingImageIds, newFiles, postContent, imageUrls);
    return successResponse(res, deal, "Post rescheduled successfully");
  }),

  deleteScheduledPost: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const deal = await socialPostService.deleteScheduledPost(id);
    return successResponse(res, deal, "Scheduled post deleted successfully");
  }),

  uploadMedia: asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const media = await socialPostService.uploadMedia(files);
    return successResponse(res, media, "Media uploaded successfully", 201);
  }),

  getPostMedia: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const media = await socialPostService.getPostMedia(id);
    return successResponse(res, media, "Media retrieved successfully");
  }),

  getQuoteImages: asyncHandler(async (req: Request, res: Response) => {
    const { quoteId } = req.params as { quoteId: string };
    const images = await socialPostService.getQuoteImages(quoteId);
    return successResponse(res, images, "Quote images retrieved successfully");
  }),
};
