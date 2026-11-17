import { z } from "zod";

// The settings page sends "" for empty fields, so empty strings are allowed.
const optionalText = (max: number) => z.string().max(max).nullable().optional();

const parkBody = z.object({
  name: z.string().trim().min(1, "Park name is required").max(200),
  location: optionalText(200),
  city: optionalText(200),
  county: optionalText(200),
  code: optionalText(50),
  description: optionalText(2000),
  image_1: optionalText(2000),
  image_2: optionalText(2000),
});

const idParams = z.object({ id: z.string().uuid("Invalid park id") });

export const createParkValidator = z.object({
  body: parkBody,
});

export const updateParkValidator = z.object({
  params: idParams,
  body: parkBody.partial(),
});

export const parkIdValidator = z.object({
  params: idParams,
});
