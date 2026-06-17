import { Request, Response } from 'express';
import { emailService } from './email.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../utils/get-user-id';

function requireUserId(req: Request): string {
  const userId = getUserId(req);
  if (!userId) {
    throw new AppError('Unauthorized', 401);
  }
  return userId;
}

export const emailController = {
  // ─── Accounts ──────────────────────────────────────────────────────────────

  getSharedAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const account = await emailService.getSharedAccount(userId);
    return successResponse(res, account, 'Shared email account retrieved successfully');
  }),

  listAccounts: asyncHandler(async (req: Request, res: Response) => {
    const sessionUserId = requireUserId(req);
    const requestedUserId = req.params.userId as string;
    if (requestedUserId !== sessionUserId) {
      throw new AppError('Forbidden', 403);
    }
    const accounts = await emailService.listAccounts(sessionUserId, sessionUserId);
    return successResponse(res, accounts, 'Email accounts retrieved successfully');
  }),

  getAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const account = await emailService.getAccount(req.params.id as string, userId);
    return successResponse(res, account, 'Email account retrieved successfully');
  }),

  createAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const account = await emailService.createAccount(req.body, userId);
    return successResponse(res, account, 'Email account created successfully', 201);
  }),

  updateAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const account = await emailService.updateAccount(req.params.id as string, userId, req.body, userId);
    return successResponse(res, account, 'Email account updated successfully');
  }),

  deleteAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    await emailService.deleteAccount(req.params.id as string, userId);
    res.status(204).send();
  }),

  // ─── IMAP ─────────────────────────────────────────────────────────────────

  testConnection: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const result = await emailService.testConnection(req.params.id as string, userId);
    return successResponse(res, result, result.message);
  }),

  listFolders: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const folders = await emailService.listFolders(req.params.id as string, userId);
    return successResponse(res, folders, 'Folders retrieved successfully');
  }),

  fetchMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const folder = (req.query.folder as string) ?? 'INBOX';
    const page = (req.query.page as string) ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = (req.query.pageSize as string) ? parseInt(req.query.pageSize as string, 10) : 50;
    const result = await emailService.fetchMessages(req.params.id as string, userId, folder, page, pageSize);
    return successResponse(res, result, 'Messages retrieved successfully');
  }),

  fetchMessageById: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const folder = (req.query.folder as string) ?? 'INBOX';
    const uid = parseInt(req.params.uid as string, 10);
    const message = await emailService.fetchMessageById(req.params.id as string, userId, uid, folder);
    return successResponse(res, message, 'Message retrieved successfully');
  }),

  // ─── SMTP ─────────────────────────────────────────────────────────────────

  sendEmail: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const result = await emailService.sendEmail(req.params.id as string, userId, req.body);
    return successResponse(res, result, 'Email sent successfully');
  }),
};
