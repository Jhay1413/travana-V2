import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { contactLinkController } from "./contact-link.controller";
import {
  getContactLinkValidator,
  getClientContactLinkValidator,
  linkContactValidator,
  createClientForContactValidator,
  unlinkContactValidator,
} from "./contact-link.validator";

const router = Router();

// Must precede "/:contactId" so "by-client" isn't swallowed as a contact id.
router.get("/by-client/:clientId", validate(getClientContactLinkValidator), contactLinkController.getByClient);
router.get("/:contactId", validate(getContactLinkValidator), contactLinkController.getStatus);
router.put("/:contactId", validate(linkContactValidator), contactLinkController.link);
router.post("/:contactId/client", validate(createClientForContactValidator), contactLinkController.createAndLink);
router.delete("/:contactId", validate(unlinkContactValidator), contactLinkController.unlink);

export default router;
