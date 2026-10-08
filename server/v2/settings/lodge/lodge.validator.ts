import { z } from "zod";

const optionalCount = z.number().int().min(0).nullable().optional();

// park_id stays optional: the settings UI can create a lodge without a park.
// The quote form's "Add Lodge" flow always sends one.
const lodgeBody = z.object({
  // The settings page sends "" for "no park"; the service stores that as null.
  park_id: z.union([z.string().uuid("Invalid park id"), z.literal("")]).nullable().optional(),
  lodge_name: z.string().trim().min(1, "Lodge name is required").max(200),
  lodge_code: z.string().max(50).nullable().optional(),
  image: z.string().nullable().optional(),
  adults: optionalCount,
  children: optionalCount,
  infants: optionalCount,
  bedrooms: optionalCount,
  bathrooms: optionalCount,
  sleeps: optionalCount,
  pets: optionalCount,
});

const idParams = z.object({ id: z.string().uuid("Invalid lodge id") });

export const createLodgeValidator = z.object({
  body: lodgeBody,
});

export const updateLodgeValidator = z.object({
  params: idParams,
  body: lodgeBody.partial(),
});

export const lodgeIdValidator = z.object({
  params: idParams,
});
