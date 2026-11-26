import { describe, it, expect, vi, beforeEach } from "vitest";

// A real drizzle instance over a fake pool: nothing connects, every statement the
// repository builds is captured as text + params so the SQL itself can be asserted.
const captured = vi.hoisted(() => ({ queries: [] as Array<{ text: string; values: unknown[] }> }));

vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      const vals = typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []);
      captured.queries.push({ text, values: vals });
      return { rows: [], rowCount: 0, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { portalBookingDetailRepository } from "./portal-booking-detail.repository";

const last = () => captured.queries[captured.queries.length - 1];

beforeEach(() => {
  captured.queries.length = 0;
});

describe("findOwnedHeader", () => {
  it("is scoped to the customer through the deal's client and to the one booking", async () => {
    expect(await portalBookingDetailRepository.findOwnedHeader("client-1", "booking-1")).toBeNull();
    const { text, values } = last();
    expect(text).toContain(`"transaction"."client_id" = $`);
    expect(text).toContain(`"booking_table"."id" = $`);
    expect(values).toEqual(expect.arrayContaining(["client-1", "booking-1"]));
  });

  it("binds the SESSION customer to the deal's client and the booking id, as two separate conditions", async () => {
    await portalBookingDetailRepository.findOwnedHeader("client-1", "booking-1");
    const { text, values } = last();
    const where = text.slice(text.lastIndexOf(" where "));
    expect(where).toContain(`"booking_table"."id" = $`);
    expect(where).toContain(`"transaction"."client_id" = $`);
    // The two ids are bound in the order the conditions are written: booking, then client.
    const clientParam = values.indexOf("client-1") + 1;
    const bookingParam = values.indexOf("booking-1") + 1;
    expect(where).toContain(`"transaction"."client_id" = $${clientParam}`);
    expect(where).toContain(`"booking_table"."id" = $${bookingParam}`);
  });

  it("applies the whole live-booking rule: active, not a test deal, not LOST (a NULL status stays visible)", async () => {
    await portalBookingDetailRepository.findOwnedHeader("c1", "b1");
    const where = last().text.slice(last().text.lastIndexOf(" where "));
    expect(where).toContain(`"booking_table"."is_active" = $`);
    expect(where).toContain(`"transaction"."is_test" = $`);
    expect(where).toContain(`"booking_status" <> 'LOST'`);
    expect(where).toContain(`"booking_status" is null`);
  });

  it("never shows a raw id as a room type: an id that matches no room type reads NULL", async () => {
    await portalBookingDetailRepository.findAccommodations("b1");
    const { text } = last();
    expect(text).toContain("THEN NULL ELSE");
    expect(text.toLowerCase()).not.toContain("coalesce(\"room_type\".\"name\"");
  });

  it("never reads cost or commission columns", async () => {
    await portalBookingDetailRepository.findOwnedHeader("c1", "b1");
    const select = last().text.split(" from ")[0];
    // The extras subquery sums cost to arrive at the customer total (the same figure as the list); no cost column is selected as itself.
    expect(select).not.toMatch(/"commission"/);
    expect(select).not.toMatch(/"package_commission"/);
    expect(select).not.toMatch(/"wallet_credit"/);
  });
});

describe("item readers", () => {
  it.each([
    ["findFlights", "booking_flights"],
    ["findAccommodations", "booking_accomodation"],
    ["findTransfers", "booking_transfers"],
    ["findCarHires", "booking_car_hire"],
    ["findTickets", "booking_attraction_ticket"],
    ["findLounges", "booking_lounge_pass"],
    ["findParkings", "booking_airport_parking"],
    ["findCruises", "booking_cruise"],
    ["findUpsells", "booking_upsell"],
  ] as const)("%s reads one booking's rows and no cost, commission, reference or note column", async (name, table) => {
    await portalBookingDetailRepository[name]("booking-1");
    const { text, values } = last();
    expect(text).toContain(`"${table}"`);
    expect(values).toContain("booking-1");
    const select = text.split(" from ")[0];
    expect(select).not.toMatch(/"cost"|"commission"|"booking_ref"|"flight_ref"|"note"|"sales_price"|"car_reg_number"|"cabin_number"/);
  });

  it("only active extras are read", async () => {
    await portalBookingDetailRepository.findUpsells("b1");
    expect(last().text).toContain(`"is_active" = $`);
  });
});
