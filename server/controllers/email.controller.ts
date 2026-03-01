import { Request, Response } from "express";
import { emailService } from "../services/email.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const emailController = {
  // ─── Accounts ──────────────────────────────────────────────────────────────

  listAccounts: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const accounts = await emailService.listAccounts(userId);
    return successResponse(res, accounts, "Email accounts retrieved successfully");
  }),

  getAccount: asyncHandler(async (req: Request, res: Response) => {
    const account = await emailService.getAccount(req.params.id as string);
    return successResponse(res, account, "Email account retrieved successfully");
  }),

  createAccount: asyncHandler(async (req: Request, res: Response) => {
    const account = await emailService.createAccount(req.body);
    return successResponse(res, account, "Email account created successfully", 201);
  }),

  updateAccount: asyncHandler(async (req: Request, res: Response) => {
    const account = await emailService.updateAccount(req.params.id as string, req.body);
    return successResponse(res, account, "Email account updated successfully");
  }),

  deleteAccount: asyncHandler(async (req: Request, res: Response) => {
    await emailService.deleteAccount(req.params.id as string);
    res.status(204).send();
  }),

  // ─── IMAP ─────────────────────────────────────────────────────────────────

  testConnection: asyncHandler(async (req: Request, res: Response) => {
    const result = await emailService.testConnection(req.params.id as string);
    return successResponse(res, result, result.message);
  }),

  listFolders: asyncHandler(async (req: Request, res: Response) => {
    const folders = await emailService.listFolders(req.params.id as string);
    return successResponse(res, folders, "Folders retrieved successfully");
  }),

  fetchMessages: asyncHandler(async (req: Request, res: Response) => {
    const folder = req.query.folder as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const messages = await emailService.fetchMessages(req.params.id as string, folder ?? "INBOX", limit);
    return successResponse(res, messages, "Messages retrieved successfully");
  }),

  fetchMessageById: asyncHandler(async (req: Request, res: Response) => {
    const folder = req.query.folder as string | undefined;
    const uid = parseInt(req.params.uid as string, 10);
    const message = await emailService.fetchMessageById(req.params.id as string, uid, folder ?? "INBOX");
    return successResponse(res, message, "Message retrieved successfully");
  }),

  // ─── SMTP ─────────────────────────────────────────────────────────────────

  sendEmail: asyncHandler(async (req: Request, res: Response) => {
    const result = await emailService.sendEmail(req.params.id as string, req.body);
    return successResponse(res, result, "Email sent successfully");
  }),
};
