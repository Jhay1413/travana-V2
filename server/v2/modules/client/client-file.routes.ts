import { Router } from "express";
import multer from "multer";
import { isAuthenticated } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/async-handler";
import { clientFileController } from "./client-file.controller";

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.use(isAuthenticated);

router.get("/client/:clientId", asyncHandler(clientFileController.list));
router.post("/client/:clientId", upload.single("file"), asyncHandler(clientFileController.upload));
router.get("/:id/download", asyncHandler(clientFileController.download));
router.delete("/:id", asyncHandler(clientFileController.remove));

export default router;
