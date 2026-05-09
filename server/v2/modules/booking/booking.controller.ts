import { Request, Response } from "express";
import { bookingService } from "./booking.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";

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

  addFlight: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.id as string;
    const flight = await bookingService.addFlight(bookingId, req.body);
    return successResponse(res, flight, "Flight added", 201);
  }),

  removeFlight: asyncHandler(async (req: Request, res: Response) => {
    const flightId = req.params.flightId as string;
    await bookingService.removeFlight(flightId);
    res.status(204).send();
  }),

  addAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const bookingId = req.params.id as string;
    const accommodation = await bookingService.addAccommodation(bookingId, req.body);
    return successResponse(res, accommodation, "Accommodation added", 201);
  }),

  removeAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const accommodationId = req.params.accommodationId as string;
    await bookingService.removeAccommodation(accommodationId);
    res.status(204).send();
  }),
};
