import { Request, Response } from "express";
import { newQuoteService } from "../services/newQuote.service";
import { socialPostService } from "../services/social-post.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { getUserId } from "../utils/get-user-id";

const QUOTE_STATUS_MAP: Record<string, string> = {
  // New-enum identity pass-through
  "quoted": "quoted",
  "in_play": "in_play",
  "lost": "lost",
  "archived": "archived",
  // Legacy label → new-enum mapping
  "In Play": "quoted",
  "in play": "quoted",
  "New Lead": "quoted",
  "NEW_LEAD": "quoted",
  "Quote In Progress": "quoted",
  "QUOTE_IN_PROGRESS": "quoted",
  "Quote Call": "quoted",
  "QUOTE_CALL": "quoted",
  "Quote Ready": "quoted",
  "QUOTE_READY": "quoted",
  "Requote": "quoted",
  "REQUOTE": "quoted",
  "draft": "quoted",
  "Awaiting Decision": "in_play",
  "AWAITING_DECISION": "in_play",
  "Won": "quoted",
  "WON": "quoted",
  "accepted": "quoted",
  "Archived": "archived",
  "ARCHIVED": "archived",
  "Inactive": "archived",
  "INACTIVE": "archived",
  "Expired": "archived",
  "EXPIRED": "archived",
  "Lost": "lost",
  "LOST": "lost",
};

function normalizeQuoteStatus(data: any) {
  if (data.quote_status) {
    data.quote_status = QUOTE_STATUS_MAP[data.quote_status] || "quoted";
  }
  return data;
}

export const quoteController = {
  listQuotes: asyncHandler(async (req: Request, res: Response) => {
    const { status, transactionId } = req.query;
    let quotes;

    if (transactionId && typeof transactionId === "string") {
      quotes = await newQuoteService.listQuotesByTransaction(transactionId);
    } else if (status && typeof status === "string") {
      const mappedStatus = (QUOTE_STATUS_MAP[status] || status) as Parameters<typeof newQuoteService.listQuotesByStatus>[0];
      quotes = await newQuoteService.listQuotesByStatus(mappedStatus);
    } else {
      quotes = await newQuoteService.listQuotes();
    }

    return successResponse(res, quotes, "Quotes retrieved successfully");
  }),

  listFreeQuotes: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    const scheduledOnly = req.query.scheduledOnly === "true";
    const scheduleFilter = (req.query.scheduleFilter as string) || "none";
    const rangeStart = (req.query.rangeStart as string) || "";
    const rangeEnd = (req.query.rangeEnd as string) || "";
    const search = (req.query.search as string) || "";

    const quotes = await newQuoteService.listFreeQuotesPaginated(page, pageSize, scheduledOnly, scheduleFilter, search, rangeStart, rangeEnd);
    
    return successResponse(res, {
      quotes,
      page,
      pageSize,
      hasMore: quotes.length === pageSize,
    }, "Free quotes retrieved successfully");
  }),

  getQuoteById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quote = await newQuoteService.getQuoteWithDetails(id);
    return successResponse(res, quote, "Quote retrieved successfully");
  }),

  createQuote: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body.data ? JSON.parse(req.body.data) : req.body;
    const files = (req.files as Express.Multer.File[]) || [];
    
    // Validate transaction_id is present
    if (!body.transaction_id) {
      return res.status(400).json({
        success: false,
        message: "transaction_id is required when creating a quote",
      });
    }
    
    if (files.length > 0) {
      const uploaded = await socialPostService.uploadMedia(files);
      body.images = [...(body.images || []), ...uploaded.map((m) => m.url)];
    }
    normalizeQuoteStatus(body);
    const quote = await newQuoteService.createQuote(body);
    return successResponse(res, quote, "Quote created successfully", 201);
  }),

  createSocialQuote: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body.data ? JSON.parse(req.body.data) : req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (files.length > 0) {
      const uploaded = await socialPostService.uploadMedia(files);
      body.images = [...(body.images || []), ...uploaded.map((m) => m.url)];
    }

    normalizeQuoteStatus(body);
    const quote = await newQuoteService.createSocialQuote(userId, body);
    return successResponse(res, quote, "Social quote created successfully", 201);
  }),

  duplicateQuote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const quote = await newQuoteService.duplicateQuote(id, req.body ?? {});
    return successResponse(res, quote, "Quote duplicated successfully", 201);
  }),

  updateQuote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    normalizeQuoteStatus(req.body);
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
    const accommodation = await newQuoteService.addAccommodation(
      quoteId,
      req.body,
    );
    return successResponse(
      res,
      accommodation,
      "Accommodation added successfully",
      201,
    );
  }),

  updateAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const accommodationId = req.params.accommodationId as string;
    const accommodation = await newQuoteService.updateAccommodation(
      accommodationId,
      req.body,
    );
    return successResponse(
      res,
      accommodation,
      "Accommodation updated successfully",
    );
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

  // Tag management
  updateQuoteTags: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.id as string;
    const { tags } = req.body; // Array of tag names

    if (!Array.isArray(tags)) {
      return res
        .status(400)
        .json({ success: false, message: "Tags must be an array" });
    }

    await newQuoteService.updateQuoteTags(quoteId, tags);
    const updatedQuote = await newQuoteService.getQuoteWithDetails(quoteId);
    return successResponse(res, updatedQuote, "Tags updated successfully");
  }),

  getQuoteTags: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.id as string;
    const tags = await newQuoteService.getQuoteTags(quoteId);
    return successResponse(res, tags, "Tags retrieved successfully");
  }),
};
