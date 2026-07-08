import { Router } from "express";
import { inboxesController } from "./inboxes.controller";

const router = Router();

router.get("/", inboxesController.list);

export default router;
