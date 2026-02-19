import { Router } from "express";
import { tagController } from "../controllers/tag.controller";

const router = Router();

router.get("/", tagController.getAllTags);
router.get("/search", tagController.searchTags);

export default router;
