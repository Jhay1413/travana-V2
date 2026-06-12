import { Request, Response } from "express";
import { bookingUpsellService } from "./booking-upsell.service";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";

export const bookingUpsellController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const bookingId = req.params.bookingId as string;
    const upsells = await bookingUpsellService.listByBooking(bookingId, scope);
    return successResponse(res, upsells, "Upsells retrieved successfully");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const bookingId = req.params.bookingId as string;
    const upsell = await bookingUpsellService.create(bookingId, req.body, scope);
    return successResponse(res, upsell, "Upsell added successfully", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const upsell = await bookingUpsellService.update(id, req.body, scope);
    return successResponse(res, upsell, "Upsell updated successfully");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await bookingUpsellService.remove(id, scope);
    return successResponse(res, null, "Upsell removed successfully");
  }),
};
