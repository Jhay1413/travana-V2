import { Request, Response } from 'express';
import { ticketReplyService } from './ticket-reply.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';
import { getScope } from '../../utils/scope';
import { getUserId } from '../../utils/get-user-id';
import { AppError } from '../../utils/error-handler';
import type { CreateTicketReplyBody, UpdateTicketReplyBody } from './ticket.validator';

export const ticketReplyController = {
  listByTicketId: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const replies = await ticketReplyService.listByTicketId(req.params.ticketId as string, scope);
    return successResponse(res, replies, 'Replies retrieved successfully');
  }),

  createReply: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const ticketId = req.params.ticketId as string;
    const userId = getUserId(req);
    if (!userId) throw new AppError('Unauthorized', 401);
    const { content, parentReplyId } = req.body as CreateTicketReplyBody;
    const reply = await ticketReplyService.createReply(
      { ticketId, userId, content, parentReplyId: parentReplyId ?? null },
      scope
    );
    return successResponse(res, reply, 'Reply created successfully', 201);
  }),

  updateReply: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const userId = getUserId(req);
    if (!userId) throw new AppError('Unauthorized', 401);
    const { content } = req.body as UpdateTicketReplyBody;
    const reply = await ticketReplyService.updateReply(req.params.id as string, content, userId, scope);
    return successResponse(res, reply, 'Reply updated successfully');
  }),

  deleteReply: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const userId = getUserId(req);
    if (!userId) throw new AppError('Unauthorized', 401);
    await ticketReplyService.deleteReply(req.params.id as string, userId, scope);
    res.status(204).send();
  }),

  toggleLike: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const userId = getUserId(req);
    if (!userId) throw new AppError('Unauthorized', 401);
    const result = await ticketReplyService.toggleLike(req.params.id as string, userId, scope);
    return successResponse(res, result, 'Like toggled successfully');
  }),
};
