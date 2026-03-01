import { Router } from "express";
import { emailController } from "../controllers/email.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  createEmailAccountValidator,
  updateEmailAccountValidator,
  sendEmailValidator,
  fetchMessagesValidator,
  fetchMessageByIdValidator,
} from "../validators/email.validator";

const router = Router();

// ─── Account Management ───────────────────────────────────────────────────────
router.get("/accounts/user/:userId", emailController.listAccounts);
router.get("/accounts/:id", emailController.getAccount);
router.post("/accounts", validate(createEmailAccountValidator), emailController.createAccount);
router.patch("/accounts/:id", validate(updateEmailAccountValidator), emailController.updateAccount);
router.delete("/accounts/:id", emailController.deleteAccount);

// ─── IMAP ─────────────────────────────────────────────────────────────────────
router.get("/accounts/:id/test", emailController.testConnection);
router.get("/accounts/:id/folders", emailController.listFolders);
router.get("/accounts/:id/messages", validate(fetchMessagesValidator), emailController.fetchMessages);
router.get("/accounts/:id/messages/:uid", validate(fetchMessageByIdValidator), emailController.fetchMessageById);

// ─── SMTP ─────────────────────────────────────────────────────────────────────
router.post("/accounts/:id/send", validate(sendEmailValidator), emailController.sendEmail);

export default router;
