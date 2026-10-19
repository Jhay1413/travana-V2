import { Router } from "express";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import { agentProfileController } from "./agent-profile.controller";
import {
  biggestDealsValidator,
  monthlyValidator,
  performanceValidator,
  userIdValidator,
  weekValidator,
} from "./agent-profile.validator";

const router = Router();

// Same audience as the agent page itself. The service re-checks scope on every call (fail closed).
router.use(requireOrgRole(["platform_admin", "org_admin", "branch_manager"]));

router.get("/:userId", validate(userIdValidator), agentProfileController.getHeader);
router.get("/:userId/performance", validate(performanceValidator), agentProfileController.getPerformance);
router.get("/:userId/week", validate(weekValidator), agentProfileController.getWeek);
router.get("/:userId/monthly", validate(monthlyValidator), agentProfileController.getMonthly);
router.get("/:userId/biggest-deals", validate(biggestDealsValidator), agentProfileController.getBiggestDeals);
router.get("/:userId/training", validate(userIdValidator), agentProfileController.getTraining);
// Pay is for owners and admins only: branch managers are refused at the route, not just in the service.
router.get(
  "/:userId/payouts",
  requireOrgRole(["org_admin", "platform_admin"]),
  validate(userIdValidator),
  agentProfileController.getPayouts,
);

export default router;
