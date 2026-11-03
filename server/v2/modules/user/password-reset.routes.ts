import { Router } from "express";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { errorHandler } from "../../middlewares/error.middleware";
import { passwordResetController } from "./password-reset.controller";
import { forgotPasswordSchema, resetPasswordSchema } from "./password-reset.validator";

const forgotPasswordLimiter = createRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: "Too many password reset requests — please try again in a few minutes.",
});

const router = Router();

// Mounted at /api/auth (outside the /api/v2 router), so this router carries the v2
// error handler itself: the app-level one would not recognise the v2 AppError.
router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), passwordResetController.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), passwordResetController.resetPassword);
router.use(errorHandler);

export default router;
