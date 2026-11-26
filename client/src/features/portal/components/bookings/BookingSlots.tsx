import type { PortalBookingDetail } from "@shared/portal-bookings";
import { BookingDocuments } from "../documents/BookingDocuments";
import { BookingPassports } from "../passports/BookingPassports";
import { BookingChecklist } from "./BookingChecklist";

/**
 * The design's three booking sections between the facts and the flights, in the order BookingDetailView renders them:
 *
 *   1. BookingDocumentsSlot   "My documents / Your paperwork."
 *   2. BookingPassportsSlot   "Passports / Snap it, we'll read it." (and the passport scanner)
 *   3. BookingChecklistSlot   "Getting ready / Before you go."
 *
 * Each receives the booking and renders its own section.
 */
export interface BookingSlotProps {
  booking: PortalBookingDetail;
}

export function BookingDocumentsSlot({ booking }: BookingSlotProps) {
  return <BookingDocuments bookingId={booking.id} />;
}

export function BookingPassportsSlot({ booking }: BookingSlotProps) {
  return <BookingPassports booking={booking} />;
}

export function BookingChecklistSlot({ booking }: BookingSlotProps) {
  return <BookingChecklist bookingId={booking.id} />;
}
