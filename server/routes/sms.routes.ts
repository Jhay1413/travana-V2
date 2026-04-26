import { Router } from "express";
import { smsController } from "../controllers/sms.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  createTemplateValidator,
  updateTemplateValidator,
  sendSmsValidator,
  optInValidator,
} from "../validators/sms.validator";

const router = Router();

router.get("/status", smsController.status);
router.get("/templates", smsController.listTemplates);
router.post("/templates", validate(createTemplateValidator), smsController.createTemplate);
router.put("/templates/:id", validate(updateTemplateValidator), smsController.updateTemplate);
router.delete("/templates/:id", smsController.deleteTemplate);

router.post("/preview-recipients", smsController.previewRecipients);
router.post("/send", validate(sendSmsValidator), smsController.send);
router.get("/messages", smsController.listMessages);

router.put("/clients/:id/opt-in", validate(optInValidator), smsController.setOptIn);

export default router;
