import { Request, Response } from "express";
import { quoteImageService } from "../services/quoteImage.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const quoteImageController = {
  listByQuoteId: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const images = await quoteImageService.listByQuoteId(quoteId);
    return successResponse(res, images, "Quote images retrieved successfully");
  }),

  createQuoteImage: asyncHandler(async (req: Request, res: Response) => {
    const image = await quoteImageService.createQuoteImage(req.body);
    return successResponse(res, image, "Quote image created successfully", 201);
  }),

  deleteQuoteImage: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await quoteImageService.deleteQuoteImage(id);
    res.status(204).send();
  }),
};
