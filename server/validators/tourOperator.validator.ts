import { z } from "zod";
import { insertTourOperatorSchema } from "@shared/schema";

export const createTourOperatorValidator = z.object({
  body: insertTourOperatorSchema,
});

export const updateTourOperatorValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertTourOperatorSchema.partial(),
});
