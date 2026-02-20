import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const chatController = {
  getConversations: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const conversations = await chatService.getConversations(userId);
    return successResponse(res, conversations, "Conversations retrieved");
  }),

  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    const messages = await chatService.getMessages(conversationId, userId);
    return successResponse(res, messages, "Messages retrieved");
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    const { content } = req.body;
    const message = await chatService.sendMessage(conversationId, userId, content);
    return successResponse(res, message, "Message sent", 201);
  }),

  startDirectChat: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { targetUserId } = req.body;
    const conversationId = await chatService.getOrCreateDirectConversation(userId, targetUserId);
    return successResponse(res, { conversationId }, "Direct chat ready");
  }),

  createGroupChat: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { name, participantIds } = req.body;
    const allIds = Array.from(new Set([userId, ...participantIds]));
    const conversation = await chatService.createGroupConversation(name, userId, allIds);
    return successResponse(res, conversation, "Group chat created", 201);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    await chatService.markRead(conversationId, userId);
    return successResponse(res, null, "Marked as read");
  }),
};
