import { Request, Response } from "express";
import { accommodationService } from "../services/accommodation.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const accommodationController = {
  getByQuoteId: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const accommodation = await accommodationService.getByQuoteId(quoteId);
    return successResponse(res, accommodation, "Accommodation retrieved successfully");
  }),

  createAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const accommodation = await accommodationService.createAccommodation(req.body);
    return successResponse(res, accommodation, "Accommodation created successfully", 201);
  }),

  updateAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const accommodation = await accommodationService.updateAccommodation(id, req.body);
    return successResponse(res, accommodation, "Accommodation updated successfully");
  }),
};
