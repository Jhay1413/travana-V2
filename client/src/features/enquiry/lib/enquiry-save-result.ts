/** Ids of the enquiry a create call produced; "Save & start quote" hands them on. */
export interface EnquirySaveResult {
  enquiryId: string;
  transactionId: string;
  clientId?: string;
}

/** The saved enquiry's ids from a create-transaction response, or undefined when they are missing. */
export function toSaveResult(
  enquiry: { id?: string | null; transaction_id?: string | null } | null | undefined,
  clientId?: string,
): EnquirySaveResult | undefined {
  if (!enquiry?.id || !enquiry.transaction_id) return undefined;
  return { enquiryId: enquiry.id, transactionId: enquiry.transaction_id, clientId };
}
