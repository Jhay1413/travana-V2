import { Router } from "express";
import { fileController } from "./file.controller";

const router = Router();

// Public: serves quote/booking gallery images via a presigned-S3 redirect.
router.get("/img", fileController.serveImage);

export default router;
