import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Eye } from "lucide-react";
import { bookingKeys, enquiryKeys } from "@/hooks/queries";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import type { EnrichedBooking, EnquiryTable } from "@/features/quote/types";
import { useBookingPin } from "@/features/booking/components/hooks";
import { useEnquiryPin } from "@/features/enquiry/components/hooks";
import { AssignedAgentButton } from "@/features/client/components/assigned-agent-button";
import { BookingActionsMenu } from "@/features/client/components/booking-actions-menu";
import { EnquiryActionsMenu } from "@/features/client/components/enquiry-actions-menu";
import { TopBarIconButton, TopBarPinButton, TopBarStatusPill } from "@/features/client/components/holiday/top-bar-parts";
import { useQuotePreview } from "@/features/client/components/holiday/use-quote-preview";

interface CommonProps {
  clientId: string;
  clientName: string;
  readOnly: boolean;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export interface BookingTopActionsProps extends CommonProps {
  bookingId: string;
  bookingData: EnrichedBooking;
  /** The booking's linked quote (booking.quote_id or the transaction match) and its share token, if known. */
  sourceQuoteId?: string | null;
  sourceQuoteToken?: string | null;
}

/** Action row for a booking: Preview (when it came from a quote), Pin, Booked pill, assigned agent, overflow menu. */
export function BookingTopActions({ bookingId, clientId, clientName, bookingData, sourceQuoteId: linkedQuoteId, sourceQuoteToken, readOnly, editOpen, onEditOpenChange, onDeleted }: BookingTopActionsProps) {
  const queryClient = useQueryClient();
  const booking = useMemo(() => transformQuoteData(bookingData), [bookingData]);
  const sourceQuoteId = linkedQuoteId ?? bookingData.quote_id ?? null;
  const preview = useQuotePreview(sourceQuoteId, sourceQuoteToken);
  const { isFavorited, togglePin } = useBookingPin(bookingId, {
    label: booking.quoteTitle,
    subtitle: booking.destinationName || booking.destination || "",
  });

  return (
    <>
      {sourceQuoteId && (!readOnly || sourceQuoteToken) && (
        <TopBarIconButton label="Preview as the customer sees it" onClick={preview.openPreview} disabled={preview.isPending} testId="holiday-top-preview">
          <Eye className="size-[18px]" />
        </TopBarIconButton>
      )}
      <TopBarPinButton pinned={isFavorited} onToggle={togglePin} />
      <TopBarStatusPill tone="good">
        <Check className="size-3.5" />
        Booked
      </TopBarStatusPill>
      {!readOnly && (
        <>
          <AssignedAgentButton
            transactionId={booking.transaction_id}
            userId={bookingData.user_id}
            onReallocated={() => queryClient.invalidateQueries({ queryKey: bookingKeys.all })}
          />
          <BookingActionsMenu
            bookingId={bookingId}
            clientId={clientId}
            clientName={clientName}
            booking={booking}
            onDeleted={onDeleted}
            trigger="icon"
            hideItems={["pin"]}
            editOpen={editOpen}
            onEditOpenChange={onEditOpenChange}
          />
        </>
      )}
    </>
  );
}

export interface EnquiryTopActionsProps extends CommonProps {
  enquiryId: string;
  enquiryData: EnquiryTable;
}

/** Action row for an enquiry: Pin, Enquiry pill, assigned agent, overflow menu. */
export function EnquiryTopActions({ enquiryId, clientId, clientName, enquiryData, readOnly, editOpen, onEditOpenChange, onDeleted }: EnquiryTopActionsProps) {
  const queryClient = useQueryClient();
  const destinationName = enquiryData.destinations?.[0]?.name ?? null;
  const { isFavorited, togglePin } = useEnquiryPin(enquiryId, {
    label: enquiryData.title || "Enquiry",
    subtitle: `${clientName}${destinationName ? " · " + destinationName : ""}`,
  });

  return (
    <>
      <TopBarPinButton pinned={isFavorited} onToggle={togglePin} />
      <TopBarStatusPill tone="info">Enquiry</TopBarStatusPill>
      {!readOnly && (
        <>
          <AssignedAgentButton
            transactionId={enquiryData.transaction_id}
            userId={enquiryData.user_id}
            onReallocated={() => queryClient.invalidateQueries({ queryKey: enquiryKeys.all })}
          />
          <EnquiryActionsMenu
            enquiryId={enquiryId}
            clientId={clientId}
            clientName={clientName}
            enquiry={enquiryData}
            destinationName={destinationName}
            onDeleted={onDeleted}
            trigger="icon"
            hideItems={["pin"]}
            editOpen={editOpen}
            onEditOpenChange={onEditOpenChange}
          />
        </>
      )}
    </>
  );
}
