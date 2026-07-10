import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { aiEnquiryController } from "./ai-enquiry.controller";
import { fromConversationValidator } from "./ai-enquiry.validator";

const router = Router();

router.post("/from-conversation", validate(fromConversationValidator), aiEnquiryController.fromConversation);

export default router;
