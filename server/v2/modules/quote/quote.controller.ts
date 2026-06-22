import { Request, Response } from "express";
import { newQuoteService } from "./quote.service";
import { socialPostService } from "../social-post/social-post.service";
import { pushNotificationService } from "../notification/push-notification.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";

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
    data.quote_status = QUOTE_STATUS_MAP[data.quote_status] ?? data.quote_status;
  }
  return data;
}

export const quoteController = {
  listQuotes: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { status, transactionId } = req.query;
    let quotes;

    if (transactionId && typeof transactionId === "string") {
      quotes = await newQuoteService.listQuotesByTransaction(transactionId, scope);
    } else if (status && typeof status === "string") {
      quotes = await newQuoteService.listQuotesByStatus(
        status as Parameters<typeof newQuoteService.listQuotesByStatus>[0],
        scope,
      );
    } else {
      quotes = await newQuoteService.listQuotes(scope);
    }

    return successResponse(res, quotes, "Quotes retrieved successfully");
  }),

  listFreeQuotes: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    const scheduledOnly = (req.query.scheduledOnly as string) === "true";
    const scheduleFilter = (req.query.scheduleFilter as string) || "none";
    const rangeStart = (req.query.rangeStart as string) || "";
    const rangeEnd = (req.query.rangeEnd as string) || "";
    const search = (req.query.search as string) || "";
    const unscheduledOnly = (req.query.unscheduledOnly as string) === "true";

    const quotes = await newQuoteService.listFreeQuotesPaginated(page, pageSize, scheduledOnly, scheduleFilter, search, rangeStart, rangeEnd, scope, unscheduledOnly);

    return successResponse(res, { quotes, page, pageSize, hasMore: quotes.length === pageSize }, "Free quotes retrieved successfully");
  }),

  getQuoteById: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const quote = await newQuoteService.getQuoteWithDetails(id, scope);
    return successResponse(res, quote, "Quote retrieved successfully");
  }),

  createQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const body = req.body.data ? JSON.parse(req.body.data) : req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!body.transaction_id) {
      return res.status(400).json({ success: false, message: "transaction_id is required when creating a quote" });
    }

    if (files.length > 0) {
      const uploaded = await socialPostService.uploadMedia(files);
      body.images = [...(body.images || []), ...uploaded.map((m) => m.url)];
    }
    normalizeQuoteStatus(body);
    const quote = await newQuoteService.createQuote(body, scope);
    return successResponse(res, quote, "Quote created successfully", 201);
  }),

  createSocialQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
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
    const quote = await newQuoteService.createSocialQuote(userId, body, scope);
    return successResponse(res, quote, "Social quote created successfully", 201);
  }),

  duplicateQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const quote = await newQuoteService.duplicateQuote(id, req.body ?? {}, scope);
    return successResponse(res, quote, "Quote duplicated successfully", 201);
  }),

  updateQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    normalizeQuoteStatus(req.body);
    const quote = await newQuoteService.updateQuote(id, req.body, scope);
    return successResponse(res, quote, "Quote updated successfully");
  }),

  deleteQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await newQuoteService.deleteQuote(id, scope);
    res.status(204).send();
  }),

  addFlight: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const quoteId = req.params.id as string;
    const flight = await newQuoteService.addFlight(quoteId, req.body, scope);
    return successResponse(res, flight, "Flight added successfully", 201);
  }),

  updateFlight: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const flightId = req.params.flightId as string;
    const flight = await newQuoteService.updateFlight(flightId, req.body, scope);
    return successResponse(res, flight, "Flight updated successfully");
  }),

  removeFlight: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const flightId = req.params.flightId as string;
    await newQuoteService.removeFlight(flightId, scope);
    res.status(204).send();
  }),

  addAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const quoteId = req.params.id as string;
    const accommodation = await newQuoteService.addAccommodation(quoteId, req.body, scope);
    return successResponse(res, accommodation, "Accommodation added successfully", 201);
  }),

  updateAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const accommodationId = req.params.accommodationId as string;
    const accommodation = await newQuoteService.updateAccommodation(accommodationId, req.body, scope);
    return successResponse(res, accommodation, "Accommodation updated successfully");
  }),

  removeAccommodation: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const accommodationId = req.params.accommodationId as string;
    await newQuoteService.removeAccommodation(accommodationId, scope);
    res.status(204).send();
  }),

  addTransfer: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const quoteId = req.params.id as string;
    const transfer = await newQuoteService.addTransfer(quoteId, req.body, scope);
    return successResponse(res, transfer, "Transfer added successfully", 201);
  }),

  removeTransfer: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const transferId = req.params.transferId as string;
    await newQuoteService.removeTransfer(transferId, scope);
    res.status(204).send();
  }),

  addPassenger: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const quoteId = req.params.id as string;
    const passenger = await newQuoteService.addPassenger(quoteId, req.body, scope);
    return successResponse(res, passenger, "Passenger added successfully", 201);
  }),

  removePassenger: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const passengerId = req.params.passengerId as string;
    await newQuoteService.removePassenger(passengerId, scope);
    res.status(204).send();
  }),

  updateQuoteTags: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const quoteId = req.params.id as string;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: "Tags must be an array" });
    }

    await newQuoteService.updateQuoteTags(quoteId, tags, scope);
    const updatedQuote = await newQuoteService.getQuoteWithDetails(quoteId, scope);
    return successResponse(res, updatedQuote, "Tags updated successfully");
  }),

  getQuoteTags: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const quoteId = req.params.id as string;
    const tags = await newQuoteService.getQuoteTags(quoteId, scope);
    return successResponse(res, tags, "Tags retrieved successfully");
  }),

  setPortalVisibility: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const showOnPortal = !!req.body?.show_on_portal;
    await newQuoteService.setPortalVisibility(id, showOnPortal, scope);
    res.json({ success: true, show_on_portal: showOnPortal });
  }),

  setFeatured: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const isFeatured = !!req.body?.is_featured;
    await newQuoteService.setFeatured(id, isFeatured, scope);
    res.json({ success: true, is_featured: isFeatured });
  }),

  portalPush: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const q = await newQuoteService.getTitleForPortalPush(id, scope);
    const sent = await pushNotificationService.sendToAll({
      title: "Latest Holiday Deals from Tinas Travel",
      body: q.title || "Check out our latest travel deal!",
      url: "/portal",
    });
    res.json({ success: true, sent });
  }),

  listRecentClientEngagement: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const limitRaw = Number.parseInt((req.query.limit as string) ?? "10", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
    const rows = await newQuoteService.getRecentClientEngagement(scope, limit);
    return successResponse(res, rows, "Recent client engagement");
  }),

  setPrimaryQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const quote = await newQuoteService.setPrimaryQuote(id, scope);
    return successResponse(res, quote, "Primary quote updated successfully");
  }),
};
