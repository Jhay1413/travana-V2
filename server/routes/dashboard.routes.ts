import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";

const router = Router();

router.get("/stats", dashboardController.getStats);
router.get("/my-profit", dashboardController.getMyProfit);

export default router;
