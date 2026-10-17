import { z } from "zod";

/** Self-service profile fields for PATCH /api/auth/profile. Unknown keys are ignored. */
export const authProfileSchema = z.object({
  phoneNumber: z.string().trim().max(40).optional(),
  // Accepted only so an unchanged value is a no-op; a different email is refused by the handler.
  email: z.string().trim().max(200).optional(),
});
