import { z } from 'zod';

export const listPortalDealsValidator = z.object({
  query: z.object({
    country: z.string().trim().min(1).optional(),
    tag: z.string().trim().min(1).optional(),
    // Booleans arrive as the literal query strings "1"/"0" (matching the rest of
    // this route's existing ?recent=1 convention), not JSON booleans.
    recent: z.enum(['0', '1']).optional(),
    interests: z.enum(['0', '1']).optional(),
  }),
});
