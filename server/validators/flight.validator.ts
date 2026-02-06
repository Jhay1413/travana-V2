import { z } from "zod";
import { insertFlightSchema } from "@shared/schema";

export const createFlightValidator = z.object({
  body: insertFlightSchema,
});

export const updateFlightValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertFlightSchema.partial(),
});
