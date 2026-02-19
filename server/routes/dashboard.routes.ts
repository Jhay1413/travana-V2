import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";

const router = Router();

router.get("/stats", dashboardController.getStats);
router.get("/clients/kpis", dashboardController.getClientKPIs);
router.get("/clients/rebooking", dashboardController.getRebooking);
router.get("/clients/vip", dashboardController.getVIP);
router.get("/clients/behaviour", dashboardController.getBehaviour);
router.get("/clients/list", dashboardController.getClientList);

export default router;
