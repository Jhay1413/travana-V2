import { z } from 'zod';

const credentialsSchema = z
  .object({
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
  })
  .optional();

// config is a free-form partial ScraperConfig; validated loosely so the UI can
// tune fields without a rigid contract. Passthrough preserves unknown keys.
const configSchema = z.record(z.string(), z.unknown()).optional();

export const createScraperValidator = z.object({
  body: z.object({
    supplierKey: z.string().min(1, 'supplierKey is required'),
    supplierName: z.string().optional(),
    adapterType: z.enum(['easyjet']).optional(),
    tourOperatorId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    config: configSchema,
    credentials: credentialsSchema,
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const updateScraperValidator = z.object({
  body: z.object({
    supplierName: z.string().optional(),
    adapterType: z.enum(['easyjet']).optional(),
    tourOperatorId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    config: configSchema,
    credentials: credentialsSchema,
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid('Invalid id') }),
});

export const scrapeValidator = z.object({
  body: z.object({
    url: z.string().url('url must be a valid URL'),
    // Explicit supplier chosen in the UI dropdown. When omitted, the server
    // falls back to matching the URL against the org's configured suppliers.
    supplierKey: z.string().min(1).optional(),
    adults: z.number().int().min(1).max(9).optional(),
    children: z.number().int().min(0).max(9).optional(),
    infants: z.number().int().min(0).max(9).optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});
