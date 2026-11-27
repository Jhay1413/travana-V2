import { z } from 'zod';

/** `GET /documents`: the optional booking filter must be a uuid. Who is asking comes from the session, never from here. */
export const portalDocumentListValidator = z.object({
  query: z.object({ bookingId: z.string().uuid('Invalid booking id').optional() }),
});

/**
 * `GET /documents/:id/download`: the id is only bounded here, not format-checked, so that a malformed id gets the same
 * 404 as an unknown one or another customer's file (the service decides).
 */
export const portalDocumentDownloadValidator = z.object({
  params: z.object({ id: z.string().min(1, 'Document not found').max(100, 'Document not found') }),
});

/** `GET /documents/:id/view`: same bounded-but-unchecked id as the download, so every miss is the same 404. */
export const portalDocumentViewValidator = portalDocumentDownloadValidator;
