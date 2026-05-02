import { Router } from "express";
import { referralWithdrawalController } from "../controllers/referralWithdrawal.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  withdrawalIdParamValidator,
  processWithdrawalValidator,
  rejectWithdrawalValidator,
} from "../validators/referralWithdrawal.validator";

const router = Router();

// Admin: list all withdrawal requests
router.get("/", referralWithdrawalController.listWithdrawals);

// Admin: get a single withdrawal
router.get("/:id", validate(withdrawalIdParamValidator), referralWithdrawalController.getWithdrawalById);

// Admin: process withdrawal (confirm bank transfer sent / booking credit applied)
router.patch("/:id/process", validate(processWithdrawalValidator), referralWithdrawalController.processWithdrawal);

// Admin: reject a withdrawal (returns referral to IN_WALLET)
router.patch("/:id/reject", validate(rejectWithdrawalValidator), referralWithdrawalController.rejectWithdrawal);

// Admin: get a presigned URL to view the invoice PDF
router.get("/:id/invoice", validate(withdrawalIdParamValidator), referralWithdrawalController.getInvoiceUrl);

export default router;
