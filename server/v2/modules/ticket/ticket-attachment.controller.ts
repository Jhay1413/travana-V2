import fs from 'fs';
import path from 'path';
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

    try {
      const attachment = await ticketAttachmentService.createAttachment({
        ticketId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      }, scope);

      return successResponse(res, attachment, 'Attachment uploaded successfully', 201);
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      throw error;
    }
  }),

  downloadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const attachment = await ticketAttachmentService.getAttachmentById(req.params.id as string, scope);
    const filePath = path.join(process.cwd(), 'uploads', attachment.filename);

    if (!fs.existsSync(filePath)) throw new AppError('File not found on disk', 404);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.sendFile(filePath);
  }),

  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const attachment = await ticketAttachmentService.getAttachmentById(req.params.id as string, scope);
    const filePath = path.join(process.cwd(), 'uploads', attachment.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ticketAttachmentService.deleteAttachment(req.params.id as string, scope);
    res.status(204).send();
  }),
};
