import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { aiEnquiryController } from "./ai-enquiry.controller";
import { fromConversationValidator } from "./ai-enquiry.validator";
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';

const router = Router();
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.post("/from-conversation", validate(fromConversationValidator), aiEnquiryController.fromConversation);

export default router;
