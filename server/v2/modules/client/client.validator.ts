import { z } from "zod";
import { insertClientTableSchema } from "@shared/schema";

export const createClientValidator = z.object({
  body: insertClientTableSchema,
});

export const updateClientValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertClientTableSchema.partial(),
});

export const mergeClientValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    targetId: z.string().uuid(),
  }),
});
