import { z } from "zod";

export const createVipPayoutValidator = z.object({
  body: z.object({
    referralId: z.string().uuid("referralId must be a valid UUID"),
    method: z.enum(["bank_transfer", "booking_credit"]),
    notes: z.string().optional(),
  }),
});

export const processVipPayoutValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    notes: z.string().optional(),
  }),
});

export const vipPayoutIdParamValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});
