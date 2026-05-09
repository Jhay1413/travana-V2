import { z } from "zod";
import { insertClientSchema } from "@shared/schema";

export const createClientValidator = z.object({
  body: insertClientSchema,
});

export const updateClientValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertClientSchema.partial(),
});
