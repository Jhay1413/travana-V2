import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";

const router = Router();

router.get("/stats", dashboardController.getStats);
router.get("/my-profit", dashboardController.getMyProfit);
router.get("/admin-overview-stats", dashboardController.getAdminOverviewStats);

export default router;
