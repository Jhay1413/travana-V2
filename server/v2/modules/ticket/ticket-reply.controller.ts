import { Request, Response } from 'express';
import { ticketReplyService } from './ticket-reply.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';

export const ticketReplyController = {
  listByTicketId: asyncHandler(async (req: Request, res: Response) => {
    const replies = await ticketReplyService.listByTicketId(req.params.ticketId as string);
    return successResponse(res, replies, 'Replies retrieved successfully');
  }),

  createReply: asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.ticketId as string;
    const reply = await ticketReplyService.createReply({ ...req.body, ticketId });
    return successResponse(res, reply, 'Reply created successfully', 201);
  }),

  updateReply: asyncHandler(async (req: Request, res: Response) => {
    const reply = await ticketReplyService.updateReply(req.params.id as string, req.body.content);
    return successResponse(res, reply, 'Reply updated successfully');
  }),

  deleteReply: asyncHandler(async (req: Request, res: Response) => {
    await ticketReplyService.deleteReply(req.params.id as string);
    res.status(204).send();
  }),
};
