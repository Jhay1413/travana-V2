/**
 * Helpers for the portal booking specs. Setup only: the booking is made through the staff API (the booking is a
 * converted quote, so the owner, the client link and staff visibility are real) and its dates, references,
 * itinerary and status are then written straight to the practice database. The specs assert through the real
 * screens and the portal's own endpoints.
 */
import "./test-db-env";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../../server/v2/config/database";
import {
  booking,
  booking_accomodation,
  booking_flights,
  booking_transfers,
  booking_upsell,
  bookingImages,
} from "../../shared/schema";
import { bookedDeal, daysFromToday } from "./pipeline";
import type { PortalQuoteWorld } from "./portal-quotes";
import { queryRows } from "./seed";

/** Written to the cost side of every seeded row so the specs can prove it never reaches the customer. */
export const COST_MARKER = "98765.43";

export interface PortalBookingOptions {
  title: string;
  /** "yyyy-MM-dd", or days from today. */
  travelDate: string | number;
  nights?: number;
  salesPrice?: string;
  discounts?: string;
  serviceCharge?: string;
  /** The agency's reference (hays_ref) and the operator's (supplier_ref). */
  haysRef?: string;
  supplierRef?: string;
  /** Another customer's booking: made for this client instead of the world's. */
  clientId?: string;
  /** Marks the booking LOST (a dead deal, never shown). */
  lost?: boolean;
  /** Writes `booking_status` NULL (a booking whose status was never set). */
  noStatus?: boolean;
  /** Flight pair, two hotels, a transfer, an extra and two photos. */
  itinerary?: boolean;
}

export interface SeededPortalBooking {
  id: string;
  /** The quote the booking was converted from (a file linked to it shows under this booking). */
  quoteId: string;
  transactionId: string;
  title: string;
  travelDate: string;
  haysRef: string;
  supplierRef: string;
}

const dayAfter = (isoDay: string, days: number): string => {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Creates a booking for the customer with the given dates and references, and an itinerary (optional). */
export async function seedPortalBooking(page: Page, q: PortalQuoteWorld, opts: PortalBookingOptions): Promise<SeededPortalBooking> {
  const futureDay = daysFromToday(60);
  const deal = await bookedDeal(
    page.request,
    q.world,
    {
      title: opts.title,
      travel_date: futureDay,
      num_of_nights: opts.nights ?? 7,
      adult: 2,
      sales_price: opts.salesPrice ?? "2400.00",
      discounts: opts.discounts ?? "100.00",
      service_charge: opts.serviceCharge ?? "50.00",
    },
    opts.clientId ?? q.world.clientId,
  );
  const [row] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [deal.transactionId]);
  const travelDate = typeof opts.travelDate === "number" ? daysFromToday(opts.travelDate) : opts.travelDate;
  const haysRef = opts.haysRef ?? `HAY-${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const supplierRef = opts.supplierRef ?? `OP-${Math.floor(10_000 + Math.random() * 89_999)}`;

  await db
    .update(booking)
    .set({
      travel_date: travelDate,
      num_of_nights: opts.nights ?? 7,
      hays_ref: haysRef,
      supplier_ref: supplierRef,
      booking_status: opts.lost ? "LOST" : opts.noStatus ? null : "BOOKED",
      package_commission: COST_MARKER,
    })
    .where(eq(booking.id, row.id));

  if (opts.itinerary) {
    const ref = q.world.agency.ref;
    const at = (offsetDays: number, time: string) => new Date(`${dayAfter(travelDate, offsetDays)}T${time}:00Z`);
    await db.insert(booking_flights).values([
      {
        booking_id: row.id, flight_type: "inbound", flight_number: "E2E102", departing_airport_id: ref.airport2, arrival_airport_id: ref.airport,
        departure_date_time: at(7, "12:00"), arrival_date_time: at(7, "15:00"), is_included_in_package: true,
      },
      {
        booking_id: row.id, flight_type: "outbound", flight_number: "E2E101", departing_airport_id: ref.airport, arrival_airport_id: ref.airport2,
        departure_date_time: at(0, "10:30"), arrival_date_time: at(0, "14:00"), is_included_in_package: true, cost: COST_MARKER, commission: "12.00",
      },
    ]);
    await db.insert(booking_accomodation).values([
      {
        booking_id: row.id, accomodation_id: ref.accommodation, board_basis_id: ref.boardBasis, room_type: "Double sea view",
        check_in_date_time: at(0, "16:00"), is_primary: true, no_of_nights: 4, is_included_in_package: true, cost: COST_MARKER, commission: "12.00",
      },
      {
        booking_id: row.id, accomodation_id: ref.accommodation, board_basis_id: ref.boardBasis2, room_type: "Family suite",
        check_in_date_time: at(4, "16:00"), is_primary: false, no_of_nights: 3, is_included_in_package: true,
      },
    ]);
    await db.insert(booking_transfers).values({
      booking_id: row.id, pick_up_location: "Palma airport", drop_off_location: "Hotel Playa Azul", pick_up_time: at(0, "14:45"),
      is_included_in_package: true, note: "STAFF-ONLY transfer note", cost: COST_MARKER,
    });
    await db.insert(booking_upsell).values({
      booking_id: row.id, upsell_type: "EXTRA_NIGHTS", description: "Two extra nights at Hotel Playa Azul", quantity: 1,
      cost: COST_MARKER, commission: "30.00", sales_price: "222.22",
    });
    await db.insert(bookingImages).values(
      ["/favicon.png", "/opengraph.jpg"].map((url, i) => ({ id: randomUUID(), bookingId: row.id, url, isPrimary: i === 0, position: i })),
    );
  }
  return { id: row.id, quoteId: deal.entityId, transactionId: deal.transactionId, title: opts.title, travelDate, haysRef, supplierRef };
}
