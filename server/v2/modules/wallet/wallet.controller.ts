import { Request, Response } from 'express';
import { walletService } from './wallet.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';

export const walletController = {
  listAll: asyncHandler(async (_req: Request, res: Response) => {
    const txs = await walletService.listAll();
    return successResponse(res, txs, 'Wallet transactions retrieved');
  }),

  getBalance: asyncHandler(async (req: Request, res: Response) => {
    const clientId = req.params.clientId as string;
    const balance = await walletService.getBalance(clientId);
    return successResponse(res, { balance: balance.toFixed(2) }, 'Balance retrieved');
  }),

  getTransactions: asyncHandler(async (req: Request, res: Response) => {
    const clientId = req.params.clientId as string;
    const txs = await walletService.getTransactions(clientId);
    return successResponse(res, txs, 'Transactions retrieved');
  }),

  applyBookingCredit: asyncHandler(async (req: Request, res: Response) => {
    const clientId = req.params.clientId as string;
    const { booking_id, amount } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    const tx = await walletService.applyBookingCredit(clientId, booking_id, parsed);
    return successResponse(res, tx, 'Booking credit applied', 201);
  }),

  processDebit: asyncHandler(async (req: Request, res: Response) => {
    const tx = await walletService.processDebit(req.params.id as string, req.body);
    return successResponse(res, tx, 'Transaction processed');
  }),

  rejectDebit: asyncHandler(async (req: Request, res: Response) => {
    const tx = await walletService.rejectDebit(req.params.id as string, req.body.notes);
    return successResponse(res, tx, 'Transaction rejected');
  }),

  getInvoiceUrl: asyncHandler(async (req: Request, res: Response) => {
    const url = await walletService.getInvoicePresignedUrl(req.params.id as string);
    if (!url) {
      return res.status(404).json({ success: false, message: 'No invoice available for this transaction' });
    }
    return successResponse(res, { url }, 'Invoice URL generated');
  }),
};
