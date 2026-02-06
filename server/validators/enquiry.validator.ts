import { z } from "zod";
import { insertEnquirySchema } from "@shared/schema";

export const createEnquiryValidator = z.object({
  body: insertEnquirySchema,
});

export const updateEnquiryValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertEnquirySchema.partial(),
});
