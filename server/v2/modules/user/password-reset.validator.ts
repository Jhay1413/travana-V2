import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 6;

/**
 * Forgot password only checks that an email string was sent. It deliberately does
 * NOT check the format: a malformed address must get the same reply as an unknown
 * one, so the response never tells a caller which addresses are well formed or known.
 */
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string({ required_error: "Email is required", invalid_type_error: "Email is required" }).trim().min(1, "Email is required"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: "Token and password are required", invalid_type_error: "Token and password are required" })
      .min(1, "Token and password are required"),
    password: z
      .string({ required_error: "Token and password are required", invalid_type_error: "Token and password are required" })
      .min(1, "Token and password are required")
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  }),
});
