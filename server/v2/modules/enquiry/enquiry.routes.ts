import { Router } from "express";
import { enquiryController } from "./enquiry.controller";

const router = Router();

router.get("/", enquiryController.listEnquiries);
router.get("/:id", enquiryController.getEnquiryById);
router.get("/transaction/:transactionId", enquiryController.getEnquiryByTransactionId);
router.post("/", enquiryController.createEnquiry);
router.patch("/:id", enquiryController.updateEnquiry);
router.delete("/:id", enquiryController.deleteEnquiry);

export default router;
