import { z } from "zod";
import { phoneNumberSchema } from "../neon-client/neon-client.validator";

export const getContactLinkValidator = z.object({
  params: z.object({ contactId: z.string().min(1) }),
  query: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    name: z.string().optional(),
  }),
});

export const getClientContactLinkValidator = z.object({
  params: z.object({ clientId: z.string().uuid() }),
});

export const linkContactValidator = z.object({
  params: z.object({ contactId: z.string().min(1) }),
  body: z.object({ clientId: z.string().uuid() }),
});

export const createClientForContactValidator = z.object({
  params: z.object({ contactId: z.string().min(1) }),
  body: z.object({
    title: z.string().trim().optional().nullable(),
    firstName: z.string().trim().min(1, "First name is required"),
    surename: z.string().trim().min(1, "Surname is required"),
    phoneNumber: phoneNumberSchema,
    email: z.string().trim().email().optional().or(z.literal("")).nullable(),
  }),
});

export const unlinkContactValidator = z.object({
  params: z.object({ contactId: z.string().min(1) }),
});
