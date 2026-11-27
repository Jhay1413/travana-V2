import { cn } from "@/lib/utils";
import { usePortalDocuments } from "../../api/use-portal-documents";
import { usePortalPassengers } from "../../api/use-portal-passengers";
import { buildChecklist } from "../../lib/booking-paperwork";
import { Eyebrow, PortalSection, SplitHeading } from "../brand";

/**
 * The design's "Getting ready / Before you go." list. Only rows backed by real data: passport details (from the travellers)
 * and travel documents (from the customer's files). A row whose data has not arrived is left out, and with no rows the
 * whole section is.
 */
export function BookingChecklist({ bookingId }: { bookingId: string }) {
  const passengers = usePortalPassengers();
  const documents = usePortalDocuments(bookingId);
  const rows = buildChecklist(passengers.data ?? null, documents.data ? documents.data.length : null);
  if (rows.length === 0) return null;

  return (
    <PortalSection aria-labelledby="booking-ready" className="pb-6 pt-[72px]" data-testid="booking-checklist">
      <Eyebrow className="mb-3.5">Getting ready</Eyebrow>
      <SplitHeading id="booking-ready" lead="Before" italic="you go." className="mb-[26px]" />
      <ol>
        {rows.map((row) => (
          <li key={row.key} className="flex gap-5 border-t border-border py-[22px]" data-testid={`checklist-${row.key}`}>
            <div className="portal-serif w-7 flex-none text-[22px] portal-text-amber-ink">{row.numeral}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 [overflow-wrap:anywhere]">
              <div className="portal-serif text-[22px] font-medium text-primary">{row.label}</div>
              <div className="text-sm leading-[1.6] text-muted-foreground">{row.note}</div>
            </div>
            <div className={cn("flex-none whitespace-nowrap pt-[7px] text-[10px] uppercase tracking-[0.22em]", row.done ? "portal-text-amber-ink" : "text-muted-foreground")} data-testid={`checklist-status-${row.key}`}>
              {row.status}
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-border" />
    </PortalSection>
  );
}
