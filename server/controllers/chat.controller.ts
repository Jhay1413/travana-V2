import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { getUserId } from "../utils/get-user-id";
import sanitizeHtml from "sanitize-html";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOADS_DIR = path.resolve("uploads", "chat");

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "s", "ul", "ol", "li", "a", "span"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
};

export const chatController = {
  getConversations: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const conversations = await chatService.getConversations(userId);
    return successResponse(res, conversations, "Conversations retrieved");
  }),

  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    const messages = await chatService.getMessages(conversationId, userId);
    return successResponse(res, messages, "Messages retrieved");
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    const rawContent = req.body.content || "";
    const content = sanitizeHtml(rawContent, sanitizeOptions);
    const message = await chatService.sendMessage(conversationId, userId, content);
    return successResponse(res, message, "Message sent", 201);
  }),

  sendMessageWithFile: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    const rawContent = req.body.content || "";
    const content = sanitizeHtml(rawContent, sanitizeOptions);
    const file = (req as any).file as Express.Multer.File | undefined;
    let fileData: { fileUrl: string; fileName: string; fileType: string; fileSize: number } | undefined;
    if (file) {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const ext = path.extname(path.basename(file.originalname));
      const safeFilename = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(UPLOADS_DIR, safeFilename);
      fs.writeFileSync(filePath, file.buffer);
      fileData = {
        fileUrl: `/api/chat/files/${safeFilename}`,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
      };
    }
    const message = await chatService.sendMessage(conversationId, userId, content, fileData);
    return successResponse(res, message, "Message sent", 201);
  }),

  serveFile: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    return res.sendFile(resolved);
  }),

  startDirectChat: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { targetUserId } = req.body;
    const conversationId = await chatService.getOrCreateDirectConversation(userId, targetUserId);
    return successResponse(res, { conversationId }, "Direct chat ready");
  }),

  createGroupChat: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { name, participantIds } = req.body;
    const allIds = Array.from(new Set([userId, ...participantIds]));
    const conversation = await chatService.createGroupConversation(name, userId, allIds);
    return successResponse(res, conversation, "Group chat created", 201);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { conversationId } = req.params;
    await chatService.markRead(conversationId, userId);
    return successResponse(res, null, "Marked as read");
  }),
};
