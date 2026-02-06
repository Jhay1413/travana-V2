import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { quoteImageController } from "../controllers/quoteImage.controller";
import { validate } from "../middlewares/validation.middleware";
import { createQuoteImageValidator } from "../validators/quoteImage.validator";

const uploadDir = path.join(process.cwd(), "uploads", "quote-images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images (JPEG, PNG, GIF, WebP) are allowed"));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get("/quote/:quoteId", quoteImageController.listByQuoteId);
router.get("/file/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }
  res.sendFile(filePath);
});
router.post("/", validate(createQuoteImageValidator), quoteImageController.createQuoteImage);
router.post("/upload/:quoteId", upload.array("images", 10), quoteImageController.uploadImages);
router.patch("/:id/primary", quoteImageController.setPrimary);
router.delete("/:id", quoteImageController.deleteQuoteImage);

export default router;
