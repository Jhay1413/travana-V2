import { Router } from "express";
import multer from "multer";
import { noteAttachmentController } from "./note-attachment.controller";
import { validate } from "../../middlewares/validation.middleware";
import { AppError } from "../../utils/error-handler";
import {
  listByNoteValidator,
  listByTransactionValidator,
  uploadToNoteValidator,
  attachmentIdValidator,
} from "./note-attachment.validator";
import {
  NOTE_ATTACHMENT_ALLOWED_MIME_TYPES,
  NOTE_ATTACHMENT_MAX_FILE_SIZE,
  NOTE_ATTACHMENT_MAX_FILES,
} from "./note-attachment.types";

// In-memory upload — bytes go straight to S3 (see note-attachment.service.ts).
const fileFilter = (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if ((NOTE_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("Only images, PDF, Word, Excel, text and CSV files are allowed", 400));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: NOTE_ATTACHMENT_MAX_FILE_SIZE, files: NOTE_ATTACHMENT_MAX_FILES },
});

// Auth + org/branch scope are applied where this router is mounted (routes/index.ts).
const router = Router();

router.get("/note/:noteId", validate(listByNoteValidator), noteAttachmentController.listByNoteId);
router.get("/transaction/:transactionId", validate(listByTransactionValidator), noteAttachmentController.listByTransactionId);
router.post("/note/:noteId", validate(uploadToNoteValidator), upload.array("files", NOTE_ATTACHMENT_MAX_FILES), noteAttachmentController.uploadAttachments);
router.get("/:id/download", validate(attachmentIdValidator), noteAttachmentController.downloadAttachment);
router.delete("/:id", validate(attachmentIdValidator), noteAttachmentController.deleteAttachment);

export default router;
