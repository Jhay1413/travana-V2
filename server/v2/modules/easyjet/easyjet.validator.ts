import { z } from 'zod';

export const scrapeQuoteValidator = z.object({
  body: z.object({
    url: z
      .string({ required_error: 'url is required' })
      .url('url must be a valid URL')
      .refine((u) => u.includes('easyjet.com') && u.includes('/holidays/'), {
        message: 'url must be an easyJet holidays trade-portal link',
      }),
    adults: z.number().int().min(1).max(9).optional(),
    children: z.number().int().min(0).max(9).optional(),
    infants: z.number().int().min(0).max(9).optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});
