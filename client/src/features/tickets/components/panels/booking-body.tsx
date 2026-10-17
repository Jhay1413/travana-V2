import { useBooking } from "@/hooks/queries";
import { airportLabel, nightsLabel } from "../../lib/holiday-format";
import { formatShortDate } from "../../lib/ticket-display";
import { HolidayView } from "./holiday-view";
import type { KvItem } from "./panel-parts";

interface FlightLike {
  departing_airport_name?: string | null;
  departure_date_time?: string | null;
}

export interface Operator {
  name: string | null;
  logoUrl: string | null;
}

/** The linked booking: refs, dates, departure airport, destination, hotel and board. */
export function BookingBody({ bookingId, operator }: { bookingId: string; operator: Operator }) {
  const { data: booking, isLoading } = useBooking(bookingId);
  if (isLoading && !booking) return <p className="px-[18px] py-4 text-[12px] text-social-muted">Loading booking…</p>;
  if (!booking) return null;

  const primary = booking.accommodations?.find((a) => a.is_primary) ?? booking.accommodations?.[0];
  // The detail payload carries the departure airport per flight; take the earliest.
  const flights = (booking as { flights?: FlightLike[] }).flights ?? [];
  const firstFlight = [...flights].sort((a, b) => new Date(a.departure_date_time || 0).getTime() - new Date(b.departure_date_time || 0).getTime())[0];
  const airport = airportLabel(firstFlight?.departing_airport_name);
  const date = formatShortDate(booking.travel_date);
  const nights = nightsLabel(booking.num_of_nights);

  const fields: KvItem[] = [];
  if (date) fields.push({ label: "Dates", value: nights ? `${date} · ${nights}` : date, span: 2, strong: true });
  else if (nights) fields.push({ label: "Nights", value: nights });
  if (primary?.accomodation_name) fields.push({ label: "Hotel", value: primary.accomodation_name, span: 2 });
  if (primary?.board_basis_name) fields.push({ label: "Board", value: primary.board_basis_name });
  if (booking.destination_name) fields.push({ label: "Destination", value: booking.destination_name });
  if (airport) fields.push({ label: "Departure airport", value: airport, span: 2 });

  const refs: Array<[string, string]> = [];
  if (booking.hays_ref) refs.push(["HAYS number", booking.hays_ref]);
  if (booking.supplier_ref) refs.push(["Tour operator ref", booking.supplier_ref]);

  return (
    <HolidayView
      model={{
        title: booking.title || "Booking",
        subtitle: [booking.destination_name, operator.name].filter(Boolean).join(" · ") || null,
        operatorName: operator.name,
        operatorLogoUrl: operator.logoUrl,
        status: null,
        refs,
        fields,
      }}
    />
  );
}
