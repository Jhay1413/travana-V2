import { Request, Response } from "express";
import { transactionService } from "../services/transaction.service";
import { socialPostService } from "../services/social-post.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

const BUDGET_TYPE_MAP: Record<string, string> = {
  "Per Person": "PER_PERSON",
  "per person": "PER_PERSON",
  "PER_PERSON": "PER_PERSON",
  "Package": "PACKAGE",
  "package": "PACKAGE",
  "PACKAGE": "PACKAGE",
};

const ENQUIRY_STATUS_MAP: Record<string, string> = {
  "Active": "ACTIVE",
  "active": "ACTIVE",
  "ACTIVE": "ACTIVE",
  "New Lead": "NEW_LEAD",
  "new_lead": "NEW_LEAD",
  "NEW_LEAD": "NEW_LEAD",
  "Lost": "LOST",
  "LOST": "LOST",
  "Inactive": "INACTIVE",
  "INACTIVE": "INACTIVE",
  "Expired": "EXPIRED",
  "EXPIRED": "EXPIRED",
};

const QUOTE_STATUS_MAP: Record<string, string> = {
  "In Play": "QUOTE_IN_PROGRESS",
  "in play": "QUOTE_IN_PROGRESS",
  "New Lead": "NEW_LEAD",
  "NEW_LEAD": "NEW_LEAD",
  "Quote In Progress": "QUOTE_IN_PROGRESS",
  "QUOTE_IN_PROGRESS": "QUOTE_IN_PROGRESS",
  "Quote Call": "QUOTE_CALL",
  "QUOTE_CALL": "QUOTE_CALL",
  "Quote Ready": "QUOTE_READY",
  "QUOTE_READY": "QUOTE_READY",
  "Awaiting Decision": "AWAITING_DECISION",
  "AWAITING_DECISION": "AWAITING_DECISION",
  "Requote": "REQUOTE",
  "REQUOTE": "REQUOTE",
  "Won": "WON",
  "WON": "WON",
  "Archived": "ARCHIVED",
  "ARCHIVED": "ARCHIVED",
  "Lost": "LOST",
  "LOST": "LOST",
  "Inactive": "INACTIVE",
  "INACTIVE": "INACTIVE",
  "Expired": "EXPIRED",
  "EXPIRED": "EXPIRED",
};

function normalizeEnquiry(data: any) {
  const normalized = { ...data };
  if (normalized.budget_type) {
    normalized.budget_type = BUDGET_TYPE_MAP[normalized.budget_type] || "PACKAGE";
  }
  if (normalized.status) {
    normalized.status = ENQUIRY_STATUS_MAP[normalized.status] || "NEW_LEAD";
  }
  return normalized;
}

function normalizeQuote(data: any) {
  const normalized = { ...data };
  if (normalized.quote_status) {
    normalized.quote_status = QUOTE_STATUS_MAP[normalized.quote_status] || "QUOTE_IN_PROGRESS";
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
    const { clientId, agentId, status, dateFrom, dateTo } = req.query;
    let transactions;

    const parsedDateFrom = dateFrom && typeof dateFrom === "string" ? new Date(dateFrom) : undefined;
    const parsedDateTo = dateTo && typeof dateTo === "string" ? new Date(dateTo) : undefined;

    if (clientId && typeof clientId === "string") {
      transactions = await transactionService.listTransactionsByClient(clientId);
    } else if (agentId && typeof agentId === "string") {
      transactions = await transactionService.listTransactionsByAgent(agentId);
    } else {
      transactions = await transactionService.listTransactions(parsedDateFrom, parsedDateTo);
    }

    return successResponse(res, transactions, "Transactions retrieved successfully");
  }),

  listTransactionsLightweight: asyncHandler(async (_req: Request, res: Response) => {
    const transactions = await transactionService.listTransactionsLightweight();
    return successResponse(res, transactions, "Pipeline transactions retrieved successfully");
  }),

  listPipelineByStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = req.params.status as string;
    const validStatuses: Record<string, string> = {
      enquiry: "on_enquiry",
      quote: "on_quote",
      in_play: "in_play",
      booking: "on_booking",
    };
    const dbStatus = validStatuses[status];
    if (!dbStatus) {
      return res.status(400).json({ success: false, message: "Invalid pipeline status" });
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const agentId = req.query.agentId as string | undefined;
    const quoteStatusFilter = req.query.quoteStatus as string | undefined;
    const result = await transactionService.listPipelineByStatus(dbStatus, page, limit, agentId || undefined, quoteStatusFilter || undefined);
    return successResponse(res, result, "Pipeline data retrieved");
  }),

  getTransactionById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const txn = await transactionService.getTransactionWithDetails(id);
    return successResponse(res, txn, "Transaction retrieved successfully");
  }),

  createTransaction: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { enquiry, quote, booking, ...transactionData } = body;

    const files = (req.files as Express.Multer.File[]) || [];
    let uploadedUrls: string[] = [];
    if (files.length > 0) {
      const uploaded = await socialPostService.uploadMedia(files);
      uploadedUrls = uploaded.map((m) => m.url);
    }
    if (uploadedUrls.length > 0) {
      if (quote) quote.images = [...(quote.images || []), ...uploadedUrls];
      if (booking) booking.images = [...(booking.images || []), ...uploadedUrls];
    }

    if (enquiry) {
      const normalizedEnquiry = normalizeEnquiry(enquiry);
      const result = await transactionService.createTransactionWithEnquiry(transactionData, normalizedEnquiry);
      return successResponse(res, result, "Transaction with enquiry created successfully", 201);
    }

    if (quote) {
      if (!quote.holiday_type_id || !quote.travel_date) {
        return res.status(400).json({ success: false, error: "Quote requires holiday_type_id and travel_date" });
      }
      const normalizedQuote = normalizeQuote(quote);
      const result = await transactionService.createTransactionWithQuote(transactionData, normalizedQuote);
      return successResponse(res, result, "Transaction with quote created successfully", 201);
    }

    if (booking) {
      if (!booking.holiday_type_id || !booking.travel_date) {
        return res.status(400).json({ success: false, error: "Booking requires holiday_type_id and travel_date" });
      }
      const normalizedBooking = normalizeBooking(booking);
      const result = await transactionService.createTransactionWithBooking(transactionData, normalizedBooking);
      return successResponse(res, result, "Transaction with booking created successfully", 201);
    }

    const txn = await transactionService.createTransaction(transactionData);
    return successResponse(res, txn, "Transaction created successfully", 201);
  }),

  updateTransaction: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const txn = await transactionService.updateTransaction(id, req.body);
    return successResponse(res, txn, "Transaction updated successfully");
  }),

  deleteTransaction: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await transactionService.deleteTransaction(id);
    res.status(204).send();
  }),

  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await transactionService.getStats();
    return successResponse(res, stats, "Transaction stats retrieved successfully");
  }),
};
