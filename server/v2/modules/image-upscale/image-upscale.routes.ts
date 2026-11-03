import { Router } from "express";
import multer from "multer";
import { imageUpscaleController } from "./image-upscale.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createUpscaleJobValidator, listUpscaleJobsValidator, upscaleJobIdValidator } from "./image-upscale.validator";
import { ALLOWED_IMAGE_MIME_TYPES } from "../../utils/image-storage";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post("/jobs", upload.single("file"), validate(createUpscaleJobValidator), imageUpscaleController.createJob);
router.get("/jobs", validate(listUpscaleJobsValidator), imageUpscaleController.listJobs);
// Registered before /jobs/:id so "mine" is not parsed as an id.
router.get("/jobs/mine", imageUpscaleController.listMine);
router.get("/jobs/:id", validate(upscaleJobIdValidator), imageUpscaleController.getJob);
router.post("/jobs/:id/revert", validate(upscaleJobIdValidator), imageUpscaleController.revertJob);

export default router;
