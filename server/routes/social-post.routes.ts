import { Router } from "express";
import { socialPostController } from "../controllers/social-post.controller";

const router = Router();

router.post("/generate", socialPostController.generatePost);
router.get("/quote/:quoteId", socialPostController.getByQuoteId);
router.patch("/:id", socialPostController.update);

export default router;
