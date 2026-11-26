import { Router } from "express";
import { isAuthenticated } from "../../middlewares/auth";
import { blockReadOnlyClientRoles } from "../../middlewares/auth/block-read-only-roles";
import { restrictReferralAgent } from "../../middlewares/auth/referral-gate";
import { orgBranchScope } from "../../middlewares/org-branch-scope";
import { validate } from "../../middlewares/validation.middleware";
import { sendSevenContext } from "../conversation-integration/conversation-integration.middleware";
import { customerMessagingStaffController as c } from "./customer-messaging-staff.controller";
import { availabilityValidator, logValidator, staffSendValidator } from "./customer-messaging-staff.validator";

// The staff-facing endpoints: any staff member who can open the client, homeworkers included (the service refuses
// WhatsApp for them). Mounted before the manager-only settings router on the same path, so each route here carries
// its own session checks and that router is never reached for these three paths.
const router = Router();
const auth = [isAuthenticated, orgBranchScope, restrictReferralAgent] as const;

router.get("/availability", ...auth, validate(availabilityValidator), sendSevenContext, c.getAvailability);
// Read-only roles (social media manager) may read the history but not send.
router.post("/send", ...auth, blockReadOnlyClientRoles, validate(staffSendValidator), sendSevenContext, c.send);
router.get("/log", ...auth, validate(logValidator), c.getLog);

export default router;
