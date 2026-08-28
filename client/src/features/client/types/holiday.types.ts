import type { Booking } from "@/features/quote/types";

/** What's currently selected in the All Holidays list, read by the Details panel. */
export interface HolidaySelection {
  type: "enquiry" | "quote" | "booking";
  id: string;
}

/** Bookings as `pages/client` derives them: raw booking rows plus the owning agent id. */
export type HolidayBooking = Booking & { user_id?: string };
