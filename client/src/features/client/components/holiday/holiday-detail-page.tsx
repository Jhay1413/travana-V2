import { useMemo } from "react";
import type { EnquiryTable, Quote } from "@/features/quote/types";
import type { ClientCreateKind, HolidayBooking, HolidaySelection } from "@/features/client/types";
import { BookingDetail } from "@/features/client/components/holiday/booking-detail";
import { EnquiryDetail } from "@/features/client/components/holiday/enquiry-detail";
import { HolidaysRail } from "@/features/client/components/holiday/holidays-rail";
import type { HolidayDetailBaseProps } from "@/features/client/components/holiday/holiday-detail.types";
import { HolidayShellFrame } from "@/features/client/components/holiday/holiday-page-shell";
import { QuoteDetail } from "@/features/client/components/holiday/quote-detail";

/**
 * Redesigned client holiday page (quote, booking or enquiry) shown at
 * /clients/:clientId?holiday=<kind>:<id>.
 *
 * Props:
 * - clientId / clientName / clientPhone / clientBadge: the client the page belongs to.
 * - selection: the open holiday; the matching composition is mounted and re-mounted per holiday.
 * - enquiries / quotes / bookings: the client's transactions, for the rail, the compare set and the booked state.
 * - readOnly: hides every write control (social media manager).
 * - isLoadingTransactions: lets the rail show its loading text.
 * - onSelect: picking a holiday in the rail; the page pushes ?holiday=<kind>:<id>.
 * - onCreate: the rail "+" menu; omit for read-only roles.
 * - onOpenExpiryDialog: opens the page's single shared Update Expiry dialog.
 * - onDeleted: called after the open deal is deleted.
 */
export interface HolidayDetailPageProps {
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  clientBadge?: string | null;
  selection: HolidaySelection;
  enquiries: EnquiryTable[];
  quotes: Quote[];
  bookings: HolidayBooking[];
  readOnly: boolean;
  isLoadingTransactions?: boolean;
  onSelect: (selection: HolidaySelection) => void;
  onCreate?: (kind: ClientCreateKind) => void;
  onOpenExpiryDialog: (dateExpiry: string | Date | null | undefined) => void;
  onDeleted: () => void;
}

export function HolidayDetailPage({
  clientId,
  clientName,
  clientPhone,
  clientBadge,
  selection,
  enquiries,
  quotes,
  bookings,
  readOnly,
  isLoadingTransactions,
  onSelect,
  onCreate,
  onOpenExpiryDialog,
  onDeleted,
}: HolidayDetailPageProps) {
  const rail = useMemo(
    () => (
      <HolidaysRail
        enquiries={enquiries}
        quotes={quotes}
        bookings={bookings}
        selection={selection}
        onSelect={onSelect}
        onCreate={onCreate}
        isLoading={isLoadingTransactions}
        clientId={clientId}
      />
    ),
    [enquiries, quotes, bookings, selection, onSelect, onCreate, isLoadingTransactions, clientId],
  );

  const common: HolidayDetailBaseProps = {
    id: selection.id,
    clientId,
    clientName,
    clientPhone,
    clientBadge,
    readOnly,
    onOpenExpiryDialog,
    onDeleted,
    quotes,
    bookings,
  };

  return (
    <HolidayShellFrame rail={rail}>
      {selection.type === "quote" && <QuoteDetail key={selection.id} {...common} />}
      {selection.type === "booking" && <BookingDetail key={selection.id} {...common} />}
      {selection.type === "enquiry" && <EnquiryDetail key={selection.id} {...common} />}
    </HolidayShellFrame>
  );
}
