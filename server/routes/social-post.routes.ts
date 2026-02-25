import { Router } from "express";
import multer from "multer";
import { socialPostController } from "../controllers/social-post.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post("/generate", socialPostController.generatePost);
router.get("/quote/:quoteId/images", socialPostController.getQuoteImages);
router.get("/quote/:quoteId", socialPostController.getByQuoteId);
router.patch("/:id", socialPostController.update);

router.post("/media/upload", upload.array("files", 10), socialPostController.uploadMedia);
router.post("/:id/schedule", upload.array("files", 10), socialPostController.schedulePost);
router.put("/:id/reschedule", upload.array("files", 10), socialPostController.reschedulePost);
router.delete("/:id/schedule", socialPostController.deleteScheduledPost);
router.get("/:id/media", socialPostController.getPostMedia);

export default router;
