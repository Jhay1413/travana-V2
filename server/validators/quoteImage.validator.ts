import { z } from "zod";
import { insertQuoteImageSchema } from "@shared/schema";

export const createQuoteImageValidator = z.object({
  body: insertQuoteImageSchema,
});

export const updateQuoteImageValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertQuoteImageSchema.partial(),
});
