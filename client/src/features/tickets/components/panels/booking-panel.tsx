import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransactionDetails } from "@/hooks/queries";
import { getTourOperator } from "@/features/pipeline";
import { holidayLabelOf, mainQuoteOf } from "@/features/transaction";
import { dealTypeHref } from "@/lib/deal-links";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import type { Ticket } from "../../types";
import { BookingBody } from "./booking-body";
import { EnquiryBody } from "./enquiry-body";
import { NoBookingPanel } from "./no-booking-panel";
import { PanelShell } from "./panel-parts";
import { QuoteBody } from "./quote-body";

const KIND_LABEL = { booking: "booking", quote: "quote", enquiry: "enquiry" } as const;

/** Right-hand panel: the linked holiday (booking, quote or enquiry) or the "no booking" picker. */
export function BookingPanel({ ticket, onChange, className }: { ticket: Ticket; onChange: () => void; className?: string }) {
  const { data: transaction, isLoading } = useTransactionDetails(ticket.transactionId);

  if (!ticket.transactionId) return <NoBookingPanel ticket={ticket} className={className} />;

  const kind = transaction ? holidayLabelOf(transaction).kind : null;
  const operator = transaction ? getTourOperator(transaction) : { name: null, logoUrl: null };
  const quote = transaction && kind === "quote" ? mainQuoteOf(transaction) : undefined;

  let body = null;
  let openHref: string | null = null;
  if (transaction && kind === "booking" && transaction.booking) {
    body = <BookingBody bookingId={transaction.booking.id} operator={operator} />;
    openHref = dealTypeHref("booking", transaction.booking.id, ticket.clientId);
  } else if (quote) {
    body = <QuoteBody quoteId={quote.id} operator={operator} />;
    openHref = dealTypeHref("quote", quote.id, ticket.clientId);
  } else if (transaction && kind === "enquiry" && transaction.enquiry) {
    body = <EnquiryBody enquiry={transaction.enquiry} />;
    openHref = dealTypeHref("enquiry", transaction.enquiry.id, ticket.clientId);
  }

  return (
    <PanelShell label="Booking" className={className}>
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="ticket-booking-panel">
        {isLoading && !transaction ? (
          <p className="px-[18px] py-4 text-[12px] text-social-muted">Loading holiday…</p>
        ) : (
          body ?? <p className="px-[18px] py-4 text-[12px] text-social-muted">This holiday&apos;s details are not available.</p>
        )}
      </div>
      <div className="flex flex-none gap-2 border-t border-social-border px-[18px] py-3">
        {openHref && kind && (
          <Button asChild variant="outline" className={`${OUTLINE_ACTION} h-[38px] flex-1 px-0`}>
            <Link href={openHref} data-testid="ticket-open-holiday">
              Open {KIND_LABEL[kind]}
              <ExternalLink className="h-3.5 w-3.5 text-social-muted" />
            </Link>
          </Button>
        )}
        {ticket.clientId && (
          <Button type="button" variant="outline" className={`${OUTLINE_ACTION} h-[38px] flex-1 px-0`} onClick={onChange} data-testid="ticket-change-holiday">
            Change holiday
          </Button>
        )}
      </div>
    </PanelShell>
  );
}
