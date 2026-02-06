import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

export const createUserValidator = z.object({
  body: insertUserSchema,
});

export const updateUserValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertUserSchema.partial(),
});
