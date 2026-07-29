import { Request, Response } from "express";
import { quoteImageService } from "./quote-image.service";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import type { PresignQuoteImagesBody } from "./quote.validator";

export const quoteImageController = {
  /**
   * Presign direct-to-S3 PUTs for quote image uploads.
   * POST /api/v2/quotes/images/presign
   */
  presignUploads: asyncHandler(async (req: Request, res: Response) => {
    const { files } = req.body as PresignQuoteImagesBody;
    const results = await quoteImageService.presignUploads(files);
    return successResponse(res, results, "Upload URLs generated successfully");
  }),

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
   * Set the display order of a quote's images
   * PATCH /api/v2/quotes/:quoteId/images/order  { imageIds: [...] }
   */
  reorderImages: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const { imageIds, imageUrls } = req.body as { imageIds?: string[]; imageUrls?: string[] };

    const images = await quoteImageService.reorderImages(quoteId, { imageIds, imageUrls });

    return successResponse(res, images, "Image order updated successfully");
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

    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: `Unsupported file type: ${file.mimetype}` });
      }
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ success: false, message: `File too large (max 5MB): ${file.originalname}` });
      }
    }

    const addedImages = await quoteImageService.uploadFiles(quoteId, files);
    return successResponse(res, addedImages, `${addedImages.length} image(s) uploaded successfully`, 201);
  }),
};
