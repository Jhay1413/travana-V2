import { Request, Response } from "express";
import { quoteService } from "../services/quote.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const quoteController = {
  listQuotes: asyncHandler(async (req: Request, res: Response) => {
    const { status, clientId } = req.query;
    let quotes;

    if (status && typeof status === "string") {
      quotes = await quoteService.listQuotesByStatus(status);
    } else if (clientId && typeof clientId === "string") {
      quotes = await quoteService.listQuotesByClient(clientId);
    } else {
      quotes = await quoteService.listQuotes();
    }

    return successResponse(res, quotes, "Quotes retrieved successfully");
  }),

  getQuoteById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quote = await quoteService.getQuoteById(id);
    return successResponse(res, quote, "Quote retrieved successfully");
  }),

  getQuoteFullDetails: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quoteDetails = await quoteService.getQuoteFullDetails(id);
    return successResponse(res, quoteDetails, "Quote details retrieved successfully");
  }),

  createQuote: asyncHandler(async (req: Request, res: Response) => {
    const quote = await quoteService.createQuote(req.body);
    return successResponse(res, quote, "Quote created successfully", 201);
  }),

  updateQuote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quote = await quoteService.updateQuote(id, req.body);
    return successResponse(res, quote, "Quote updated successfully");
  }),

  convertToBooking: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { haysReference, tourReference } = req.body;
    const quote = await quoteService.convertToBooking(id, haysReference, tourReference);
    return successResponse(res, quote, "Quote converted to booking successfully");
  }),

  deleteQuote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await quoteService.deleteQuote(id);
    res.status(204).send();
  }),
};
