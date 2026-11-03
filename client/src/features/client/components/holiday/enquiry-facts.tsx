import { useMemo } from "react";
import type { EnquiryTable } from "@/features/quote/types";
import { buildEnquiryFields } from "@/features/client/components/holiday-fields";
import { factRows } from "@/features/client/lib/holiday-facts";
import { FactsCard } from "@/features/client/components/holiday/facts-card";

/**
 * Facts card for an enquiry: destinations, dates and flexibility, nights, passengers, budget, status and so on,
 * built by buildEnquiryFields (holiday-type aware: standard, cruise, hot tub).
 *
 * Props:
 * - enquiry: the enquiry detail response.
 * - agentName: the assigned agent's name for the "Assigned Agent" row, or null.
 * - readOnly / onEdit: same as FactsCard (Edit opens the enquiry edit drawer).
 */
export interface EnquiryFactsProps {
  enquiry: EnquiryTable;
  agentName: string | null;
  readOnly: boolean;
  onEdit?: () => void;
}

export function EnquiryFacts({ enquiry, agentName, readOnly, onEdit }: EnquiryFactsProps) {
  const fields = useMemo(() => factRows(buildEnquiryFields(enquiry, agentName)), [enquiry, agentName]);
  return <FactsCard title="Enquiry details" fields={fields} readOnly={readOnly} onEdit={onEdit} />;
}
