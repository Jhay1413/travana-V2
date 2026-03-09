import { Request, Response } from "express";
import { quoteImageService } from "../services/quote-image.service";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

export const quoteImageController = {
  /**
   * Add images to a quote
   * POST /api/quotes/:quoteId/images
   */
  addImages: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const { images } = req.body;

    console.log(`📸 Controller: Adding images to quote ${quoteId}`, images.length);

    const addedImages = await quoteImageService.addImages(quoteId, images);

    return successResponse(
      res,
      addedImages,
      `${addedImages.length} image(s) added successfully`,
      201
    );
  }),

  /**
   * Get all images for a quote
   * GET /api/quotes/:quoteId/images
   */
  getImages: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;

    const images = await quoteImageService.getQuoteImages(quoteId);

    return successResponse(res, images, "Images retrieved successfully");
  }),

  /**
   * Delete an image from a quote
   * DELETE /api/quotes/:quoteId/images/:imageId
   */
  deleteImage: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const imageId = req.params.imageId as string;

    await quoteImageService.deleteImage(quoteId, imageId);

    return successResponse(res, null, "Image deleted successfully");
  }),

  /**
   * Set an image as primary
   * PATCH /api/quotes/:quoteId/images/:imageId/primary
   */
  setPrimaryImage: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const imageId = req.params.imageId as string;

    const image = await quoteImageService.setPrimaryImage(quoteId, imageId);

    return successResponse(res, image, "Primary image updated successfully");
  }),

  /**
   * Upload image files for a quote
   * POST /api/quotes/:quoteId/images/upload
   */
  uploadImages: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files provided" });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "quote-images");
    await fs.mkdir(uploadDir, { recursive: true });

    const MIME_TO_EXT: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };

    const savedFiles: string[] = [];
    const urls: string[] = [];
    try {
      for (const file of files) {
        const ext = MIME_TO_EXT[file.mimetype] || ".jpg";
        const filename = `${randomUUID()}${ext}`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, file.buffer);
        savedFiles.push(filepath);
        urls.push(`/uploads/quote-images/${filename}`);
      }

      const addedImages = await quoteImageService.addImages(quoteId, urls);
      return successResponse(res, addedImages, `${addedImages.length} image(s) uploaded successfully`, 201);
    } catch (err) {
      for (const fp of savedFiles) {
        await fs.unlink(fp).catch(() => {});
      }
      throw err;
    }
  }),
};
