import { z } from "zod";
import { websiteSchema } from "../../utils/website-schema";

export const businessSchema = z.object({
  body: z.object({
    businessType: z.enum(["single", "multi"]),
    businessName: z.string().trim().min(2, "Business name is required").max(200),
    phone: z.string().trim().min(1, "Phone is required").max(40),
    address: z.string().trim().min(5, "Address is required").max(200),
    website: websiteSchema,
    email: z.string().trim().email("Email must be valid").max(200),
  }),
});

const shopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Shop name is required")
    .max(100)
    .refine((v) => v.toLowerCase() !== "homeworker", 'The name "Homeworker" is reserved'),
  phone: z.string().trim().min(1, "Shop phone is required").max(40),
  address: z.string().trim().min(5, "Shop address is required").max(200),
  email: z.string().trim().email("Shop email must be valid").max(200),
  // Blank means "no manager to invite".
  managerEmail: z.union([z.literal(""), z.string().trim().email("Manager email must be valid").max(200)]),
});

export const shopsSchema = z.object({
  body: z.object({
    shops: z.array(shopSchema).min(1, "Add at least one shop").max(50, "You can add up to 50 shops at a time"),
  }),
});

export const homeworkerCommissionSchema = z.object({
  body: z.object({
    percent: z
      .number({ invalid_type_error: "Commission must be a whole number from 0 to 100" })
      .int("Commission must be a whole number from 0 to 100")
      .min(0, "Commission must be a whole number from 0 to 100")
      .max(100, "Commission must be a whole number from 0 to 100")
      .nullable(),
  }),
});
