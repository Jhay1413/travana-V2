import { z } from "zod";

export const usageHistoryQuerySchema = z.object({
  query: z.object({
    months: z.coerce.number().int().min(1).max(24).default(6),
  }),
});
