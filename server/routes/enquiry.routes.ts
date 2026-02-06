import { Router } from "express";
import { enquiryController } from "../controllers/enquiry.controller";
import { validate } from "../middlewares/validation.middleware";
import { createEnquiryValidator, updateEnquiryValidator } from "../validators/enquiry.validator";

const router = Router();

router.get("/", enquiryController.listEnquiries);
router.get("/:id", enquiryController.getEnquiryById);
router.post("/", validate(createEnquiryValidator), enquiryController.createEnquiry);
router.patch("/:id", validate(updateEnquiryValidator), enquiryController.updateEnquiry);
router.delete("/:id", enquiryController.deleteEnquiry);

export default router;
