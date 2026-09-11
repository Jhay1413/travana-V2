import { Request, Response } from 'express';
import { ticketAttachmentService } from './ticket-attachment.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';
import { AppError } from '../../utils/error-handler';
import { getScope } from '../../utils/scope';

export const ticketAttachmentController = {
  listByTicketId: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const attachments = await ticketAttachmentService.listByTicketId(req.params.ticketId as string, scope);
    return successResponse(res, attachments, 'Attachments retrieved successfully');
  }),

  uploadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const ticketId = req.params.ticketId as string;
    const file = req.file;
    if (!file) throw new AppError('No file uploaded', 400);

    // multer puts non-file multipart fields on req.body.
    const replyId = typeof req.body?.replyId === "string" && req.body.replyId ? req.body.replyId : null;
    const attachment = await ticketAttachmentService.uploadAndCreate(
      ticketId,
      { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype, size: file.size, replyId },
      scope,
    );
    return successResponse(res, attachment, 'Attachment uploaded successfully', 201);
  }),

  downloadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const inline = req.query.inline === '1' || req.query.disposition === 'inline';
    const target = await ticketAttachmentService.getDownloadTarget(req.params.id as string, scope, { inline });

    if (target.kind === 's3') return res.redirect(target.url);

    const disposition = inline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', target.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${target.originalName}"`);
    return res.sendFile(target.filePath);
  }),

  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    await ticketAttachmentService.deleteAttachment(req.params.id as string, scope);
    res.status(204).send();
  }),
};
