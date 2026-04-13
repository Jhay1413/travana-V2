import { z } from "zod";

export const referralPayoutIdParamValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const approveRejectPayoutValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    notes: z.string().optional(),
  }),
});
