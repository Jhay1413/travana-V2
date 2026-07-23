import { Request, Response } from "express";
import { transactionService } from "./transaction.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";
import { authStorage } from "../../middlewares/auth";
import { normalizeEnquiry } from "../../utils/enum-normalizers";
import { uploadImageToS3 } from "../../utils/image-storage";

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
  "Awaiting Decision": "in_play",
  "AWAITING_DECISION": "in_play",
  "Won": "quoted",
  "WON": "quoted",
  "accepted": "quoted",
  "draft": "quoted",
  "Archived": "archived",
  "ARCHIVED": "archived",
  "Inactive": "archived",
  "INACTIVE": "archived",
  "Expired": "archived",
  "EXPIRED": "archived",
  "Lost": "lost",
  "LOST": "lost",
};

function normalizeQuote(data: any) {
  const normalized = { ...data };
  if (normalized.quote_status) {
    normalized.quote_status = QUOTE_STATUS_MAP[normalized.quote_status] ?? normalized.quote_status;
  }
  if (!normalized.transfer_type) {
    normalized.transfer_type = "none";
  }
  if (!normalized.price_per_person && normalized.price_per_person !== 0) {
    normalized.price_per_person = "0.00";
  }
  return normalized;
}

function normalizeBooking(data: any) {
  const normalized = { ...data };
  if (!normalized.hays_ref) normalized.hays_ref = "";
  if (!normalized.supplier_ref) normalized.supplier_ref = "";
  if (!normalized.transfer_type) normalized.transfer_type = "none";
  if (normalized.deleted_at === undefined) {
    delete normalized.deleted_at;
  }
  return normalized;
}

export const transactionController = {
  listTransactions: asyncHandler(async (req: Request, res: Response) => {
    const { clientId, agentId, dateFrom, dateTo, branchId } = req.query;
    const scope = getScope(req);

    const asString = (v: unknown) =>
      typeof v === "string" && v.length > 0 ? v : undefined;
    const asDate = (v: unknown) => {
      const s = asString(v);
      if (!s) return undefined;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };

    // Authorization is handled in the repository via scope conditions:
    //   - branch_manager / agent → pinned to scope.branchId
    //   - homeworker            → pinned to scope.userId
    //   - org_admin             → branchOverride optional, confined to org
    //   - platform_admin        → branchOverride optional, no org confinement
    // Filters below are additive — agentId + date range now work together.
    const transactions = await transactionService.listTransactions(scope, {
      clientId: asString(clientId),
      agentId: asString(agentId),
      dateFrom: asDate(dateFrom),
      dateTo: asDate(dateTo),
      branchOverride: asString(branchId),
    });

    return successResponse(res, transactions, "Transactions retrieved successfully");
  }),

  listTransactionsLightweight: asyncHandler(async (req: Request, res: Response) => {
    const transactions = await transactionService.listTransactionsLightweight(getScope(req));
    return successResponse(res, transactions, "Pipeline transactions retrieved successfully");
  }),

  listPipelineByStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = req.params.status as string;
    // Maps the route param to the column key the repository expects.
    // Phase 3: column keys are the board column identifiers; the repo derives DB conditions.
    const validStatuses: Record<string, string> = {
      enquiry: "enquiry",
      quote: "quoted",
      in_play: "in_play",
      booking: "booking",
    };
    const column = validStatuses[status];
    if (!column) {
      return res.status(400).json({ success: false, message: "Invalid pipeline status" });
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const agentId = req.query.agentId as string | undefined;
    const quoteStatusFilter = req.query.quoteStatus as string | undefined;
    const result = await transactionService.listPipelineByStatus(getScope(req), column, page, limit, agentId || undefined, quoteStatusFilter || undefined);
    return successResponse(res, result, "Pipeline data retrieved");
  }),

  getTransactionById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const txn = await transactionService.getTransactionWithDetails(id, getScope(req));
    return successResponse(res, txn, "Transaction retrieved successfully");
  }),

  createTransaction: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { enquiry, quote, booking, ...transactionData } = body;
    const scope = getScope(req);

    const files = (req.files as Express.Multer.File[]) || [];
    let uploadedUrls: string[] = [];
    if (files.length > 0) {
      uploadedUrls = await Promise.all(files.map((f) => uploadImageToS3(f, "quote-images")));
    }
    if (uploadedUrls.length > 0) {
      if (quote) quote.images = [...(quote.images || []), ...uploadedUrls];
      if (booking) booking.images = [...(booking.images || []), ...uploadedUrls];
    }

    if (enquiry) {
      const normalizedEnquiry = normalizeEnquiry(enquiry);
      const agentId = getUserId(req);
      const result = await transactionService.createTransactionWithEnquiry(transactionData, normalizedEnquiry, scope, agentId);
      return successResponse(res, result, "Transaction with enquiry created successfully", 201);
    }

    if (quote) {
      if (!quote.holiday_type_id || !quote.travel_date) {
        return res.status(400).json({ success: false, error: "Quote requires holiday_type_id and travel_date" });
      }
      const normalizedQuote = normalizeQuote(quote);
      const result = await transactionService.createTransactionWithQuote(transactionData, normalizedQuote, scope);
      return successResponse(res, result, "Transaction with quote created successfully", 201);
    }

    if (booking) {
      if (!booking.holiday_type_id || !booking.travel_date) {
        return res.status(400).json({ success: false, error: "Booking requires holiday_type_id and travel_date" });
      }
      const normalizedBooking = normalizeBooking(booking);
      const result = await transactionService.createTransactionWithBooking(transactionData, normalizedBooking, scope);
      return successResponse(res, result, "Transaction with booking created successfully", 201);
    }

    const txn = await transactionService.createTransaction(transactionData, scope);
    return successResponse(res, txn, "Transaction created successfully", 201);
  }),

  updateTransaction: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const txn = await transactionService.updateTransaction(id, req.body, getScope(req));
    return successResponse(res, txn, "Transaction updated successfully");
  }),

  deleteTransaction: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await transactionService.deleteTransaction(id, getScope(req));
    res.status(204).send();
  }),

  getStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await transactionService.getStats(getScope(req));
    return successResponse(res, stats, "Transaction stats retrieved successfully");
  }),

  getExpiringQuotes: asyncHandler(async (req: Request, res: Response) => {
    const sessionUserId = getUserId(req as any);
    let agentId = (req.query.agentId as string) && typeof (req.query.agentId as string) === "string" ? (req.query.agentId as string) : undefined;
    if (sessionUserId) {
      const sessionUser = await authStorage.getUser(sessionUserId);
      const isRestricted = sessionUser?.role !== "Admin" && sessionUser?.role !== "Manager";
      if (isRestricted) agentId = sessionUserId;
    }
    const quotes = await transactionService.getExpiringQuotes(getScope(req), agentId);
    return successResponse(res, quotes, "Expiring quotes retrieved successfully");
  }),
};
