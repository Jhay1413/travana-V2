import { z } from "zod";
import { insertClientTableSchema } from "@shared/schema";

export const createNeonClientValidator = z.object({
  body: insertClientTableSchema,
});

export const updateNeonClientValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: insertClientTableSchema.partial(),
});
