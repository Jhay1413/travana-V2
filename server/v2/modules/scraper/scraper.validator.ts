import { z } from 'zod';

const credentialsSchema = z
  .object({
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
    abtaNumber: z.string().optional(),
  })
  .optional();

// config is a free-form partial ScraperConfig; validated loosely so the UI can
// tune fields without a rigid contract. Passthrough preserves unknown keys.
const configSchema = z.record(z.string(), z.unknown()).optional();

export const createScraperValidator = z.object({
  body: z.object({
    supplierKey: z.string().min(1, 'supplierKey is required'),
    supplierName: z.string().optional(),
    adapterType: z.enum(['easyjet', 'dom', 'jet2']).optional(),
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
    adapterType: z.enum(['easyjet', 'dom', 'jet2']).optional(),
    tourOperatorId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    config: configSchema,
    credentials: credentialsSchema,
  }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid('Invalid id') }),
});

// Manual page import: the user's OWN browser captures the rendered deal page
// (bookmarklet/extension) and posts it here, so credentialed suppliers work
// without the server driving a headless browser at all. `text` is a whole
// page's innerText, so it is capped generously rather than tightly.
export const importPageValidator = z.object({
  body: z.object({
    url: z.string().url('url must be a valid URL'),
    title: z.string().max(1_000).optional().default(''),
    text: z.string().min(1, 'text is required').max(500_000),
    // Rendered <img> sources, used for the hotel gallery.
    images: z.array(z.string()).max(400).optional(),
    // Index-aligned with `images`: each one's surrounding class names / data-tids,
    // so a spec can scope the gallery to a container.
    imageContexts: z.array(z.string().max(300)).max(400).optional(),
    // The page's h1/h2 text in document order, for the deal's headline. Short by
    // construction (the bookmarklet caps it), so the bounds are tight.
    headings: z.array(z.string().max(200)).max(20).optional(),
    // Text of a flight-details modal, when the user opened one before capturing.
    flightsText: z.string().max(50_000).optional(),
    // Any JSON the page exposed (e.g. an embedded state blob) — optional, the
    // spec prefers it via jsonPath when present.
    apiJson: z.unknown().optional(),
    // Optional override. Empty means "work the supplier out from the URL",
    // which is the normal path — so an empty string is valid, not a violation.
    supplierKey: z.string().optional(),
    adults: z.number().int().min(1).max(9).optional(),
    children: z.number().int().min(0).max(9).optional(),
    infants: z.number().int().min(0).max(9).optional(),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
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
