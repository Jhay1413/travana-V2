import { z } from "zod";

export const deleteQuoteValidator = z.object({
  params: z.object({ id: z.string().min(1, "Quote id is required") }),
  body: z.object({
    reason: z.string().trim().min(1, "Reason is required"),
    // Required only when the target quote is the transaction's primary and has
    // live siblings — enforced in auditService.deleteQuote, not here, since that
    // depends on data the validator doesn't have access to.
    newPrimaryQuoteId: z.string().uuid("newPrimaryQuoteId must be a valid id").optional(),
  }),
});

export const deleteBookingValidator = z.object({
  params: z.object({ id: z.string().min(1, "Booking id is required") }),
  body: z.object({
    reason: z.string().trim().min(1, "Reason is required"),
  }),
});
