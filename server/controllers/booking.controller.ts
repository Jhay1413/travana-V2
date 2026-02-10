import { Request, Response } from "express";
import { bookingService } from "../services/booking.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const bookingController = {
  listBookings: asyncHandler(async (_req: Request, res: Response) => {
    const bookings = await bookingService.listBookings();
    return successResponse(res, bookings, "Bookings retrieved successfully");
  }),

  getBookingById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const b = await bookingService.getBookingWithDetails(id);
    return successResponse(res, b, "Booking retrieved successfully");
  }),

  getBookingByTransactionId: asyncHandler(async (req: Request, res: Response) => {
    const transactionId = req.params.transactionId as string;
    const b = await bookingService.getBookingByTransactionId(transactionId);
    return successResponse(res, b, "Booking retrieved successfully");
  }),

  convertQuoteToBooking: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const { haysRef, supplierRef } = req.body;
    const b = await bookingService.convertQuoteToBooking(quoteId, haysRef, supplierRef);
    return successResponse(res, b, "Quote converted to booking successfully", 201);
  }),

  createBooking: asyncHandler(async (req: Request, res: Response) => {
    const b = await bookingService.createBooking(req.body);
    return successResponse(res, b, "Booking created successfully", 201);
  }),

  updateBooking: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const b = await bookingService.updateBooking(id, req.body);
    return successResponse(res, b, "Booking updated successfully");
  }),

  deleteBooking: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await bookingService.deleteBooking(id);
    res.status(204).send();
  }),
};
