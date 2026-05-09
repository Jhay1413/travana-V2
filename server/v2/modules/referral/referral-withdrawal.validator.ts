import { z } from 'zod';

export const withdrawalIdParamValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const processWithdrawalValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    transfer_reference: z.string().optional(),
    booking_id: z.string().uuid().optional(),
    credit_note: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const rejectWithdrawalValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    notes: z.string().optional(),
  }),
});
