import { Router } from "express";
import { revenueController } from "./revenue.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

router.use(requireOrgRole(["org_admin", "platform_admin"]));

router.get("/dashboard", revenueController.getDashboard);
router.get("/month-bookings/:year/:month", revenueController.getMonthBookings);
router.get("/month-forwards/:year/:month", revenueController.getMonthForwards);
router.post("/forwards/regenerate", revenueController.regenerateForwards);

export default router;
