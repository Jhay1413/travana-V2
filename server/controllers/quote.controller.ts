import { Request, Response } from "express";
import { newQuoteService } from "../services/newQuote.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const quoteController = {
  listQuotes: asyncHandler(async (req: Request, res: Response) => {
    const { status, transactionId } = req.query;
    let quotes;

    if (transactionId && typeof transactionId === "string") {
      quotes = await newQuoteService.listQuotesByTransaction(transactionId);
    } else if (status && typeof status === "string") {
      quotes = await newQuoteService.listQuotesByStatus(status);
    } else {
      quotes = await newQuoteService.listQuotes();
    }

    return successResponse(res, quotes, "Quotes retrieved successfully");
  }),

  getQuoteById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quote = await newQuoteService.getQuoteWithDetails(id);
    return successResponse(res, quote, "Quote retrieved successfully");
  }),

  createQuote: asyncHandler(async (req: Request, res: Response) => {
    const quote = await newQuoteService.createQuote(req.body);
    return successResponse(res, quote, "Quote created successfully", 201);
  }),

  updateQuote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quote = await newQuoteService.updateQuote(id, req.body);
    return successResponse(res, quote, "Quote updated successfully");
  }),

  deleteQuote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await newQuoteService.deleteQuote(id);
    res.status(204).send();
  }),

  addFlight: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.id as string;
    const flight = await newQuoteService.addFlight(quoteId, req.body);
    return successResponse(res, flight, "Flight added successfully", 201);
  }),

  updateFlight: asyncHandler(async (req: Request, res: Response) => {
    const flightId = req.params.flightId as string;
    const flight = await newQuoteService.updateFlight(flightId, req.body);
    return successResponse(res, flight, "Flight updated successfully");
  }),

  removeFlight: asyncHandler(async (req: Request, res: Response) => {
    const flightId = req.params.flightId as string;
    await newQuoteService.removeFlight(flightId);
    res.status(204).send();
  }),

  addAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.id as string;
    const accommodation = await newQuoteService.addAccommodation(quoteId, req.body);
    return successResponse(res, accommodation, "Accommodation added successfully", 201);
  }),

  updateAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const accommodationId = req.params.accommodationId as string;
    const accommodation = await newQuoteService.updateAccommodation(accommodationId, req.body);
    return successResponse(res, accommodation, "Accommodation updated successfully");
  }),

  removeAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const accommodationId = req.params.accommodationId as string;
    await newQuoteService.removeAccommodation(accommodationId);
    res.status(204).send();
  }),

  addTransfer: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.id as string;
    const transfer = await newQuoteService.addTransfer(quoteId, req.body);
    return successResponse(res, transfer, "Transfer added successfully", 201);
  }),

  removeTransfer: asyncHandler(async (req: Request, res: Response) => {
    const transferId = req.params.transferId as string;
    await newQuoteService.removeTransfer(transferId);
    res.status(204).send();
  }),

  addPassenger: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.id as string;
    const passenger = await newQuoteService.addPassenger(quoteId, req.body);
    return successResponse(res, passenger, "Passenger added successfully", 201);
  }),

  removePassenger: asyncHandler(async (req: Request, res: Response) => {
    const passengerId = req.params.passengerId as string;
    await newQuoteService.removePassenger(passengerId);
    res.status(204).send();
  }),
};
