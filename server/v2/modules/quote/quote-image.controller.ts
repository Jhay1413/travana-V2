import { Request, Response } from "express";
import { quoteImageService } from "./quote-image.service";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";

export const quoteImageController = {
  /**
   * Add images to a quote
   * POST /api/quotes/:quoteId/images
   */
  addImages: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const { images } = req.body;

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

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    const dataUrls: string[] = [];
    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: `Unsupported file type: ${file.mimetype}` });
      }
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ success: false, message: `File too large (max 5MB): ${file.originalname}` });
      }
      const base64 = file.buffer.toString("base64");
      dataUrls.push(`data:${file.mimetype};base64,${base64}`);
    }

    const addedImages = await quoteImageService.addImages(quoteId, dataUrls);
    return successResponse(res, addedImages, `${addedImages.length} image(s) uploaded successfully`, 201);
  }),
};
