import { buildEnquiryTransaction } from "@/features/enquiry/lib/build-enquiry-transaction";
import { buildEnquirySubmitData } from "@/features/enquiry/lib/enquiry-submit-data";
import type { EnquiryForm, LeadSource } from "@/features/enquiry/lib/enquiry-form";
import type { CreateTransactionData } from "@/features/quote/types";

/**
 * Create-transaction body for the inbox pop-up: the same enquiry body the create / edit
 * form saves (`buildEnquirySubmitData`), plus lead source and assignee.
 */
export function buildInboxEnquiryPayload(
  form: EnquiryForm,
  opts: { clientId: string; userId: string; leadSource: LeadSource },
): CreateTransactionData {
  const tx = buildEnquiryTransaction(buildEnquirySubmitData(form), { clientId: opts.clientId, userId: opts.userId });
  return { ...tx, lead_source: opts.leadSource };
}
