import { z } from 'zod';

export const createAirportSchema = z.object({
  body: z
    .object({
      airport_name: z.string().trim().min(1, 'Airport name is required').max(200),
      airport_code: z.string().trim().min(1, 'Airport code is required').max(10),
      country_id: z.string().uuid('Invalid country').optional(),
    })
    .strict(),
});

export const deleteAirportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid airport id'),
  }),
});
