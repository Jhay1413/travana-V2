import { Router } from "express";
import { revenueController } from "../controllers/revenue.controller";

const router = Router();

router.get("/dashboard", revenueController.getDashboard);
router.get("/month-bookings/:year/:month", revenueController.getMonthBookings);
router.get("/month-forwards/:year/:month", revenueController.getMonthForwards);

export default router;
