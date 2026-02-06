import { z } from "zod";
import { insertQuoteSchema } from "@shared/schema";

export const createQuoteValidator = z.object({
  body: insertQuoteSchema,
});

export const updateQuoteValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertQuoteSchema.partial().passthrough(),
});
