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

// One entry from the field-picker bookmarklet (picker-spec.ts's PickedField).
// Mirrors the shape the bookmarklet actually sends (public/capture-bookmarklet.js,
// `onDone`'s `pickedArr`) field-for-field — deriveSpecFromPicks trusts these
// values to locate and verify a rule against the capture, so they're
// validated as a fixed shape rather than a loose record.
const pickedFieldSchema = z.object({
  field: z.string().min(1),
  value: z.string(),
  textIndex: z.number().int(),
  lineIndex: z.number().int(),
  linesBefore: z.array(z.string()).max(10),
  linesAfter: z.array(z.string()).max(10),
  occurrenceIndex: z.number().int(),
  occurrenceCount: z.number().int(),
  tag: z.string(),
  ancestorTags: z.array(z.string()).max(20),
  siblingIndex: z.number().int(),
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
    // The full DOM text INCLUDING collapsed/hidden nodes and open shadow
    // roots — unlike `text` (innerText), which excludes anything not
    // rendered. A Royal Caribbean checkout captured with its "View Ports"
    // drawer collapsed had the whole day-by-day itinerary missing from
    // `text`, even though it was in the DOM. Same generous cap as `text`
    // (a whole page, plus hidden content); OPTIONAL, so older bookmarklet
    // versions that don't send it are unaffected.
    deepText: z.string().max(500_000).optional(),
    // Accepted for forward-compat logging; not otherwise interpreted server-side
    // (mirrors savePicksValidator).
    pickerVersion: z.number().int().positive().optional(),
    // The package type the agent declared BEFORE picking (see
    // PickerCaptureContext in picker-spec.ts) — authoritative on the derived spec.
    packageType: z.enum(['cruise', 'package-holiday', 'lodge']).optional(),
    // Present when this capture came from the bookmarklet's FIELD PICKER mode.
    // THIS is the fix for the bug where pasting a picker payload into this
    // normal import dialog silently discarded the picks: parseCapture on the
    // client used to rebuild the payload from a whitelist that omitted
    // `picked` entirely, and this validator would have stripped it a second
    // time even if the client had carried it through. Reuses pickedFieldSchema
    // — the exact same shape savePicksValidator already trusts — so the two
    // entry points (this one, and POST /scrapers/picks) can never validate a
    // pick differently. Optional: a capture with no picks behaves exactly as
    // it does today.
    picked: z.array(pickedFieldSchema).min(1, 'at least one picked field is required').optional(),
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

// Field-picker submission: stores a click-verified field mapping into a
// supplier's extraction spec (merged, not replaced — see scraper.service.ts's
// savePicks / picker-spec.ts's mergePickedIntoSpec). Same core capture fields
// as importPageValidator, minus the ones the picker doesn't send (images,
// flightsText) plus the picks themselves.
export const savePicksValidator = z.object({
  body: z.object({
    url: z.string().url('url must be a valid URL'),
    title: z.string().max(1_000).optional().default(''),
    text: z.string().min(1, 'text is required').max(500_000),
    headings: z.array(z.string().max(200)).max(20).optional(),
    apiJson: z.unknown().optional(),
    deepText: z.string().max(500_000).optional(),
    // Accepted for forward-compat logging; not otherwise interpreted server-side.
    pickerVersion: z.number().int().positive().optional(),
    // The package type the agent declared BEFORE picking (see
    // PickerCaptureContext in picker-spec.ts) — authoritative on the derived spec.
    packageType: z.enum(['cruise', 'package-holiday', 'lodge']).optional(),
    picked: z.array(pickedFieldSchema).min(1, 'at least one picked field is required'),
    // Optional override, same meaning as importPageValidator's: empty/omitted
    // means "work the supplier out from the URL".
    supplierKey: z.string().optional(),
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
