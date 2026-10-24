import { z } from "zod";

const hours = z.number().int().min(1).max(168);

export const connectTokenValidator = z.object({
  body: z.object({
    allowed_channel_types: z.array(z.string()).min(1, "allowed_channel_types is required"),
    partner_name: z.string().max(120).nullable().optional(),
    partner_redirect_url: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://"), "partner_redirect_url must be https")
      .nullable()
      .optional(),
    name: z.string().max(120).nullable().optional(),
    expires_in_hours: hours.optional(),
    max_uses: z.number().int().min(1).max(100).optional(),
  }),
});

export const delegateConnectValidator = z.object({
  body: z.object({
    email: z.string().email("A valid email is required"),
    channel_types: z.array(z.string()).min(1, "channel_types is required"),
    recipient_name: z.string().max(120).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    expires_in_hours: hours.optional(),
  }),
});
