import { Router } from "express";
import { planController } from "./plan.controller";

const router = Router();

router.get("/", planController.list);

export default router;
