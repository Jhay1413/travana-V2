import { z } from "zod";

export const createTourOperatorValidator = z.object({
  body: z.object({
    name: z.string().min(1),
  }),
});

export const updateTourOperatorValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1),
  }).partial(),
});
