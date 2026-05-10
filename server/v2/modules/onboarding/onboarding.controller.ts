import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { onboardingService } from './onboarding.service';
import { successResponse } from '../../utils/response';

export const onboardingController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const result = await onboardingService.signup(req.body);
    successResponse(res, result, 'Account created — check your email to verify', 201);
  }),
  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    await onboardingService.verifyEmail(req.query.token as string);
    successResponse(res, null, 'Your email has been verified. You can now sign in.');
  }),
  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    await onboardingService.resendVerification(req.body.email);
    successResponse(res, null, 'If that account exists and is unverified, a new verification email has been sent.');
  }),
};
