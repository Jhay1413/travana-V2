import { Request, Response } from "express";
import { noteAttachmentService } from "./note-attachment.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

export const noteAttachmentController = {
  listByNoteId: asyncHandler(async (req: Request, res: Response) => {
    const attachments = await noteAttachmentService.listByNoteId(req.params.noteId as string, getScope(req));
    return successResponse(res, attachments, "Attachments retrieved successfully");
  }),

  listByTransactionId: asyncHandler(async (req: Request, res: Response) => {
    const attachments = await noteAttachmentService.listByTransactionId(req.params.transactionId as string, getScope(req));
    return successResponse(res, attachments, "Attachments retrieved successfully");
  }),

  uploadAttachments: asyncHandler(async (req: Request, res: Response) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = await noteAttachmentService.uploadMany(
      req.params.noteId as string,
      files.map((f) => ({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype, size: f.size })),
      getScope(req),
    );
    return successResponse(res, attachments, "Attachments uploaded successfully", 201);
  }),

  downloadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const inline = req.query.inline === "1" || req.query.disposition === "inline";
    const target = await noteAttachmentService.getDownloadTarget(req.params.id as string, getScope(req), { inline });
    return res.redirect(target.url);
  }),

  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    await noteAttachmentService.deleteAttachment(req.params.id as string, getScope(req));
    res.status(204).send();
  }),
};
