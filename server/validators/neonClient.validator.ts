import { z } from "zod";
import { insertClientTableSchema } from "@shared/schema";

export const createNeonClientValidator = z.object({
  body: insertClientTableSchema,
});

export const updateNeonClientValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: insertClientTableSchema.partial().extend({
    badge: z.string().optional().nullable(),
  }),
});

const importClientRowSchema = insertClientTableSchema.extend({
  id: z.string().uuid(),
});

export const importNeonClientsValidator = z.object({
  body: z.object({
    clients: z.array(importClientRowSchema).min(1, "At least one client is required"),
  }),
});
