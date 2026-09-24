import { z } from 'zod';

/**
 * Only validates the fields this fix introduced (`quoteId`). The rest of the
 * /send body (recipients, templateId/category/bodyOverride, etc.) isn't
 * Zod-validated yet — out of scope here, and this schema doesn't tighten it,
 * since unspecified body keys are simply stripped from the *parsed* result,
 * not from `req.body` itself (see validation.middleware.ts).
 */
export const sendSmsValidator = z.object({
  body: z.object({
    /** Explicit quote to resolve the {{quote_url}} link for — see resolveQuoteToken(). */
    quoteId: z.string().uuid().optional(),
  }),
});
