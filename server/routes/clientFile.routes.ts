import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../config/database";
import { clientFiles } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";

const uploadDir = path.join(process.cwd(), "uploads", "client-files");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"));
  }
};

const upload = multer({ storage: fileStorage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(isAuthenticated);

router.get(
  "/client/:clientId",
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(clientFiles)
      .where(eq(clientFiles.clientId, req.params.clientId))
      .orderBy(desc(clientFiles.createdAt));
    return successResponse(res, rows, "Client files retrieved");
  })
);

router.post(
  "/client/:clientId",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }
    const { title, category, allocationType, allocationId } = req.body;
    const [row] = await db
      .insert(clientFiles)
      .values({
        clientId: req.params.clientId,
        filename: file.filename,
        originalName: file.originalname,
        title: title || file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        category: category || null,
        allocationType: allocationType || null,
        allocationId: allocationId || null,
      })
      .returning();
    return successResponse(res, row, "File uploaded", 201);
  })
);

router.get(
  "/:id/download",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(clientFiles).where(eq(clientFiles.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "File not found" });
    const filePath = path.join(uploadDir, row.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on disk" });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${row.originalName}"`);
    res.setHeader("Content-Type", row.mimeType);
    res.sendFile(filePath);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(clientFiles).where(eq(clientFiles.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "File not found" });
    const filePath = path.join(uploadDir, row.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await db.delete(clientFiles).where(eq(clientFiles.id, req.params.id));
    res.status(204).send();
  })
);

export default router;
