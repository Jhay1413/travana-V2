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
    const { enquiry, ...transactionData } = req.body;

    if (enquiry) {
      const result = await transactionService.createTransactionWithEnquiry(transactionData, enquiry);
      return successResponse(res, result, "Transaction with enquiry created successfully", 201);
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
