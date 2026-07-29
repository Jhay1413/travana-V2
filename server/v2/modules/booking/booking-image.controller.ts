import { Request, Response } from "express";
import { bookingImageService } from "./booking-image.service";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";

export const bookingImageController = {
  addImages: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;
    const { images } = req.body;

    const addedImages = await bookingImageService.addImages(bookingId, images);

    return successResponse(
      res,
      addedImages,
      `${addedImages.length} image(s) added successfully`,
      201
    );
  }),

  getImages: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;

    const images = await bookingImageService.getBookingImages(bookingId);

    return successResponse(res, images, "Images retrieved successfully");
  }),

  deleteImage: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;
    const imageId = req.params.imageId as string;

    await bookingImageService.deleteImage(bookingId, imageId);

    return successResponse(res, null, "Image deleted successfully");
  }),

  setPrimaryImage: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;
    const imageId = req.params.imageId as string;

    const image = await bookingImageService.setPrimaryImage(bookingId, imageId);

    return successResponse(res, image, "Primary image updated successfully");
  }),

  /**
   * Set the display order of a booking's images
   * PATCH /api/v2/bookings/:bookingId/images/order  { imageIds: [...] }
   */
  reorderImages: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;
    const { imageIds, imageUrls } = req.body as { imageIds?: string[]; imageUrls?: string[] };

    const images = await bookingImageService.reorderImages(bookingId, { imageIds, imageUrls });

    return successResponse(res, images, "Image order updated successfully");
  }),

  uploadImages: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.bookingId as string;
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

    const addedImages = await bookingImageService.uploadFiles(bookingId, files);
    return successResponse(res, addedImages, `${addedImages.length} image(s) uploaded successfully`, 201);
  }),
};
