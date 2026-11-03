import { Router } from "express";
import { enquiryController } from "./enquiry.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';
import { validate } from "../../middlewares/validation.middleware";
import { updateEnquiryValidator } from "./enquiry.validator";

const router = Router();
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.get("/", enquiryController.listEnquiries);
router.get("/:id", enquiryController.getEnquiryById);
router.get("/transaction/:transactionId", enquiryController.getEnquiryByTransactionId);
router.post("/", enquiryController.createEnquiry);
router.patch("/:id", validate(updateEnquiryValidator), enquiryController.updateEnquiry);
// Admin-only, matching quote deletion (audit routes).
router.delete("/:id", requireOrgRole(["org_admin", "platform_admin"]), enquiryController.deleteEnquiry);

export default router;
