export interface CreatedIds {
  enquiryId: string;
  transactionId: string;
}

const idOf = (v: unknown): string | null => {
  if (typeof v !== "object" || v === null) return null;
  const id = (v as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
};

/**
 * POST /transactions really answers `{ transaction, enquiry }` even though the
 * client types it as a bare Transaction; read both ids defensively.
 */
export function readCreated(response: unknown): CreatedIds | null {
  if (typeof response !== "object" || response === null) return null;
  const { transaction, enquiry } = response as { transaction?: unknown; enquiry?: unknown };
  const enquiryId = idOf(enquiry);
  const transactionId = idOf(transaction);
  return enquiryId && transactionId ? { enquiryId, transactionId } : null;
}

/** Deep link to the new enquiry on the client page. */
export function enquiryHref(clientId: string, enquiryId: string): string {
  return `/clients/${clientId}?holiday=enquiry:${enquiryId}`;
}
