import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { requestOrigin } from "../../utils/link-base";
import { passwordResetService } from "./password-reset.service";

export const FORGOT_PASSWORD_REPLY = "If an account exists with that email, a reset link has been sent.";

export const passwordResetController = {
  /**
   * Replies first, then does the work in the background, so a known and an unknown
   * email take the same time and get the same answer. Failures are logged without
   * the email or token.
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const email = (req.body as { email: string }).email;
    const origin = requestOrigin(req);
    res.json({ message: FORGOT_PASSWORD_REPLY });
    void passwordResetService.requestReset(email, origin).catch((error: unknown) => {
      console.error("Forgot password error:", error instanceof Error ? error.message : "unknown error");
    });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body as { token: string; password: string };
    await passwordResetService.resetPassword(token, password);
    res.json({ message: "Password has been reset successfully" });
  }),
};
