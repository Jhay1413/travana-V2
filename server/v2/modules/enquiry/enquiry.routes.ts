import { Router } from "express";
import { enquiryController } from "./enquiry.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

router.get("/", enquiryController.listEnquiries);
router.get("/:id", enquiryController.getEnquiryById);
router.get("/transaction/:transactionId", enquiryController.getEnquiryByTransactionId);
router.post("/", enquiryController.createEnquiry);
router.patch("/:id", enquiryController.updateEnquiry);
// Admin-only, matching quote deletion (audit routes).
router.delete("/:id", requireOrgRole(["org_admin", "platform_admin"]), enquiryController.deleteEnquiry);

export default router;
