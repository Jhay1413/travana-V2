import { z } from 'zod';

export const createReferralValidator = z.object({
  body: z.object({
    referrerClientId: z.string().uuid('referrerClientId must be a valid UUID'),
    referredName: z.string().min(1, 'referredName is required'),
    referredEmail: z.string().email('Invalid email').optional(),
    referredPhone: z.string().optional(),
    transactionId: z.string().uuid().optional(),
    travelDate: z.string().optional(),
    commission: z.string().optional(),
  }),
});

export const updateReferralValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    travelDate: z.string().optional(),
    commission: z.string().optional(),
    referredEmail: z.string().email().optional(),
    referredPhone: z.string().optional(),
  }),
});

export const updateReferralStatusValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['PENDING', 'IN_WALLET', 'PAID', 'VOIDED']),
  }),
});

export const referralIdParamValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const referrerClientParamValidator = z.object({
  params: z.object({ clientId: z.string().uuid() }),
});
