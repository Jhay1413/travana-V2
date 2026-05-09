import { Request, Response } from "express";
import { clientFileService } from "./client-file.service";
import { successResponse } from "../../utils/response";

export const clientFileController = {
  async list(req: Request, res: Response) {
    const files = await clientFileService.listByClientId(req.params.clientId);
    return successResponse(res, files, "Client files retrieved");
  },

  async upload(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }
    const { title, category, allocationType, allocationId } = req.body;
    const row = await clientFileService.upload(req.params.clientId, file, {
      title,
      category,
      allocationType,
      allocationId,
    });
    return successResponse(res, row, "File uploaded", 201);
  },

  async download(req: Request, res: Response) {
    const target = await clientFileService.getDownloadTarget(req.params.id);
    if (target.kind === "s3") {
      return res.redirect(target.url);
    }
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(target.originalName)}`);
    res.setHeader("Content-Type", target.mimeType);
    return res.sendFile(target.filePath);
  },

  async remove(req: Request, res: Response) {
    await clientFileService.delete(req.params.id);
    return res.status(204).send();
  },
};
