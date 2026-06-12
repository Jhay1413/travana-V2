import { z } from "zod";

// Mirrors the client contract (`upsellPayloadSchema` in
// client/src/types/booking/booking-upsell.types.ts). Numerics arrive as strings
// (or numbers) to match the Drizzle `numeric` columns and the existing line items.
export const UPSELL_TYPES = ["EXTRA_NIGHTS", "TRANSFER", "LOUNGE", "PARKING", "FEE", "OTHER"] as const;

const moneyLike = z.union([z.string(), z.number()]);

const upsellBody = z.object({
  upsell_type: z.enum(UPSELL_TYPES),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  cost: moneyLike.nullable().optional(),
  commission: moneyLike.nullable().optional(),
  sales_price: moneyLike.nullable().optional(),
  added_at: z.string().nullable().optional(),
});

export const createUpsellValidator = z.object({
  params: z.object({ bookingId: z.string().uuid("Invalid booking id") }),
  body: upsellBody,
});

export const updateUpsellValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid upsell id") }),
  body: upsellBody.partial(),
});

export const listUpsellsValidator = z.object({
  params: z.object({ bookingId: z.string().uuid("Invalid booking id") }),
});

export const removeUpsellValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid upsell id") }),
});

export type UpsellBody = z.infer<typeof upsellBody>;
