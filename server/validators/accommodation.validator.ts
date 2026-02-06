import { z } from "zod";
import { insertAccommodationSchema } from "@shared/schema";

export const createAccommodationValidator = z.object({
  body: insertAccommodationSchema,
});

export const updateAccommodationValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertAccommodationSchema.partial(),
});
