import { Router } from "express";
import { revenueController } from "./revenue.controller";

const router = Router();

router.get("/dashboard", revenueController.getDashboard);
router.get("/month-bookings/:year/:month", revenueController.getMonthBookings);
router.get("/month-forwards/:year/:month", revenueController.getMonthForwards);
router.post("/forwards/regenerate", revenueController.regenerateForwards);

export default router;
