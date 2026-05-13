import { z } from "zod";

const dayHoursSchema = z.object({
  day: z.string().min(1),
  open: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().min(1, "Branch address is required"),
  phone: z.string().min(1, "Branch phone is required"),
  email: z.string().email("Branch email must be valid"),
  openingPattern: z.enum(["mon-fri", "mon-sat", "seven-days"]),
  bankHolidaysOpen: z.boolean(),
  openingHours: z.array(dayHoursSchema).length(7),
});

const contactPersonSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  relationship: z.enum(["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"]),
  phone: z.string().min(1, "Contact phone is required"),
});

const agentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  email: z.string().email("Agent email must be valid"),
  phone: z.string().optional(),
  address: z.string().optional(),
  role: z.enum(["Agent", "Senior Agent", "Manager", "Admin"]),
  active: z.boolean(),
  branchIndex: z.number().int().min(0).optional(),
  contactPerson: contactPersonSchema.optional(),
});

export const signupSchema = z.object({
  body: z.object({
    agencyName: z.string().min(1, "Agency name is required"),
    slug: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
    brandColor: z.string().optional(),
    logoUrl: z.string().url().optional(),
    ownerName: z.string().min(1, "Owner name is required"),
    ownerEmail: z.string().email("Owner email must be valid"),
    ownerPhone: z.string().min(1, "Owner phone is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    branches: z.array(branchSchema).min(1, "At least one branch is required"),
    agents: z.array(agentSchema).default([]),
  }),
});

export const verifyEmailSchema = z.object({
  query: z.object({
    token: z.string().min(1, "Token is required"),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email("Email is required"),
  }),
});
