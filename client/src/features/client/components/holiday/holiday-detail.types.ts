import type { Quote } from "@/features/quote/types";
import type { HolidayBooking } from "@/features/client/types";

/** Props shared by the quote, booking and enquiry compositions. */
export interface HolidayDetailBaseProps {
  /** Id of the quote / booking / enquiry on screen. */
  id: string;
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  clientBadge?: string | null;
  readOnly: boolean;
  /** Opens the page's shared Update Expiry dialog. */
  onOpenExpiryDialog: (dateExpiry: string | Date | null | undefined) => void;
  /** Called after the deal is deleted so the page can clear the selection. */
  onDeleted: () => void;
  /** The client's quotes and bookings, to find the compare set and the booked state. */
  quotes: Quote[];
  bookings: HolidayBooking[];
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
