import { Request, Response } from "express";
import fs from "fs";
import { quoteImageService } from "../services/quoteImage.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/error-handler";

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

  uploadImages: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError("No files uploaded", 400);
    }

    try {
      const existingImages = await quoteImageService.listByQuoteId(quoteId);
      const hasPrimary = existingImages.some((img) => img.isPrimary);
      const results = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = `/api/quote-images/file/${file.filename}`;
        const image = await quoteImageService.createQuoteImage({
          quoteId,
          url,
          isPrimary: !hasPrimary && i === 0,
        });
        results.push(image);
      }
      return successResponse(res, results, "Images uploaded successfully", 201);
    } catch (error) {
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      throw error;
    }
  }),

  deleteQuoteImage: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await quoteImageService.deleteQuoteImage(id);
    res.status(204).send();
  }),
};
