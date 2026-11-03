import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

// Explicit and strict: role, orgRole, password, banned, tokens and emailVerified can never be supplied.
export const createUserValidator = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email(),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phoneNumber: z.string().trim().max(40).default(""),
    image: z.string().max(500).nullable().optional(),
    orgId: z.string().uuid().optional(),
  }).strict(),
});

export const userIdParamsValidator = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateUserValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertUserSchema.partial(),
});
