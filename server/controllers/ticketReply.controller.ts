import { Request, Response } from "express";
import { ticketReplyService } from "../services/ticketReply.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const ticketReplyController = {
  listByTicketId: asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.ticketId as string;
    const replies = await ticketReplyService.listByTicketId(ticketId);
    return successResponse(res, replies, "Replies retrieved successfully");
  }),

  createReply: asyncHandler(async (req: Request, res: Response) => {
    const ticketId = req.params.ticketId as string;
    const reply = await ticketReplyService.createReply({ ...req.body, ticketId });
    return successResponse(res, reply, "Reply created successfully", 201);
  }),

  updateReply: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { content } = req.body;
    const reply = await ticketReplyService.updateReply(id, content);
    return successResponse(res, reply, "Reply updated successfully");
  }),

  deleteReply: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await ticketReplyService.deleteReply(id);
    res.status(204).send();
  }),
};
