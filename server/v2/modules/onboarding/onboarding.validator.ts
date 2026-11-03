import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    businessName: z.string().trim().min(2, "Business name is required"),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().email("Email must be valid"),
    password: z.string().min(8, "Password must be at least 8 characters"),
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
