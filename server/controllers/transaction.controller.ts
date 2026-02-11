import { Request, Response } from "express";
import { transactionService } from "../services/transaction.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const transactionController = {
  listTransactions: asyncHandler(async (req: Request, res: Response) => {
    const { clientId, agentId, status } = req.query;
    let transactions;

    if (clientId && typeof clientId === "string") {
      transactions = await transactionService.listTransactionsByClient(clientId);
    } else if (agentId && typeof agentId === "string") {
      transactions = await transactionService.listTransactionsByAgent(agentId);
    } else {
      transactions = await transactionService.listTransactions();
    }

    return successResponse(res, transactions, "Transactions retrieved successfully");
  }),

  getTransactionById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const txn = await transactionService.getTransactionWithDetails(id);
    return successResponse(res, txn, "Transaction retrieved successfully");
  }),

  createTransaction: asyncHandler(async (req: Request, res: Response) => {
    const { enquiry, quote, booking, ...transactionData } = req.body;

    if (enquiry) {
      const result = await transactionService.createTransactionWithEnquiry(transactionData, enquiry);
      return successResponse(res, result, "Transaction with enquiry created successfully", 201);
    }

    if (quote) {
      if (!quote.holiday_type_id || !quote.travel_date) {
        return res.status(400).json({ success: false, error: "Quote requires holiday_type_id and travel_date" });
      }
      const result = await transactionService.createTransactionWithQuote(transactionData, quote);
      return successResponse(res, result, "Transaction with quote created successfully", 201);
    }

    if (booking) {
      if (!booking.holiday_type_id || !booking.travel_date) {
        return res.status(400).json({ success: false, error: "Booking requires holiday_type_id and travel_date" });
      }
      const result = await transactionService.createTransactionWithBooking(transactionData, booking);
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
