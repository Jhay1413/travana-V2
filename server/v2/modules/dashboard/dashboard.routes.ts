import { Router } from "express";
import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get("/stats", dashboardController.getStats);
router.get("/my-profit", dashboardController.getMyProfit);
router.get("/admin-overview-stats", dashboardController.getAdminOverviewStats);

export default router;
