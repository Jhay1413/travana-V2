import { z } from "zod";
import { insertAirportSchema } from "@shared/schema";

export const createAirportValidator = z.object({
  body: insertAirportSchema,
});

export const updateAirportValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertAirportSchema.partial(),
});
