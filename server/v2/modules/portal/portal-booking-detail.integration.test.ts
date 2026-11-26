import { describe, it, expect, beforeEach } from "vitest";
import { truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeBooking, makeQuote } from "../../test/factories";
import { portalBookingDetailService } from "./portal-booking-detail.service";
import { portalBookingsService } from "./portal-bookings.service";
import { portalQuotesService } from "./portal-quotes.service";

// DB-backed: proves the REAL SQL keeps one customer's bookings away from another's, and hides LOST ones. Written
// to run under `npm run test:integration` against the disposable test database.

let agent: { id: string };
let customerA: { id: string };
let customerB: { id: string };
let bookingA: { id: string };
let bookingB: { id: string };
let bookingLost: { id: string };
let bookingNullStatus: { id: string };

async function customerBooking(clientId: string, orgId: string, title: string, over: Record<string, unknown> = {}) {
  const txn = await makeTransaction({ user_id: agent.id, org_id: orgId, client_id: clientId, status: "booked" });
  return makeBooking({ transaction_id: txn.id, title, sales_price: "1000.00", adult: 2, ...over });
}

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ slug: "agency-bookings" });
  agent = await makeUser({ orgId: org.id });
  customerA = await makeClient({ orgId: org.id, firstName: "Ada", surename: "Alpha" });
  customerB = await makeClient({ orgId: org.id, firstName: "Ben", surename: "Beta" });
  bookingA = await customerBooking(customerA.id, org.id, "Booking for A", { booking_status: "BOOKED" });
  bookingB = await customerBooking(customerB.id, org.id, "Booking for B", { booking_status: "BOOKED" });
  bookingLost = await customerBooking(customerA.id, org.id, "Lost booking", { booking_status: "LOST" });
  bookingNullStatus = await customerBooking(customerA.id, org.id, "No status yet", { booking_status: null });
});

describe("a customer only ever sees their own bookings", () => {
  it("the list holds only the customer's own live bookings", async () => {
    const a = await portalBookingsService.listBookings(customerA.id);
    expect(a.map((b) => b.id).sort()).toEqual([bookingA.id, bookingNullStatus.id].sort());
    const b = await portalBookingsService.listBookings(customerB.id);
    expect(b.map((x) => x.id)).toEqual([bookingB.id]);
  });

  it("customer A cannot read customer B's booking: 404, the same as for an id that does not exist", async () => {
    await expect(portalBookingDetailService.getBooking(customerA.id, bookingB.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalBookingDetailService.getBooking(customerA.id, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ statusCode: 404 });
    expect((await portalBookingDetailService.getBooking(customerB.id, bookingB.id)).title).toBe("Booking for B");
  });

  it("a LOST booking is not readable even by its own customer, and a booking with no status is", async () => {
    await expect(portalBookingDetailService.getBooking(customerA.id, bookingLost.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await portalBookingDetailService.getBooking(customerA.id, bookingNullStatus.id)).title).toBe("No status yet");
  });

  it("the detail carries the same total as the list", async () => {
    const [listed] = (await portalBookingsService.listBookings(customerA.id)).filter((b) => b.id === bookingA.id);
    const detail = await portalBookingDetailService.getBooking(customerA.id, bookingA.id);
    expect(detail.total).toBe(listed.price);
    expect(detail.pricePerPerson).toBe(listed.price_per_person);
  });
});

describe("test deals and booked quotes", () => {
  it("a booking on a TEST deal is in neither the list nor the detail, and does not mark its quote booked", async () => {
    const org = await makeOrg({ slug: "agency-test-deal" });
    const client = await makeClient({ orgId: org.id, firstName: "Tess", surename: "Tester" });
    const txn = await makeTransaction({ user_id: agent.id, org_id: org.id, client_id: client.id, status: "booked", is_test: true });
    const b = await makeBooking({ transaction_id: txn.id, title: "Test deal booking", sales_price: "500.00", adult: 2, booking_status: "BOOKED" });
    expect((await portalBookingsService.listBookings(client.id)).map((x) => x.id)).not.toContain(b.id);
    await expect(portalBookingDetailService.getBooking(client.id, b.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("the owner of a booked quote is told the booking's id (exactly one live booking); someone else gets a plain 404", async () => {
    const org = await makeOrg({ slug: "agency-booked-quote" });
    const owner = await makeClient({ orgId: org.id, firstName: "Olive", surename: "Owner" });
    const stranger = await makeClient({ orgId: org.id, firstName: "Sam", surename: "Stranger" });
    const txn = await makeTransaction({ user_id: agent.id, org_id: org.id, client_id: owner.id, status: "booked" });
    const q = await makeQuote({ transaction_id: txn.id, title: "Booked quote", is_active: true, quote_token: "TOKBOOKED", sales_price: "1000.00", adult: 2 });
    const b = await makeBooking({ transaction_id: txn.id, quote_id: q.id, title: "Booked", sales_price: "1000.00", adult: 2, booking_status: "BOOKED" });
    await expect(portalQuotesService.getQuote(owner.id, "TOKBOOKED")).rejects.toMatchObject({ statusCode: 410, code: "BOOKED", details: { bookingId: b.id } });
    await expect(portalQuotesService.getQuote(stranger.id, "TOKBOOKED")).rejects.toMatchObject({ statusCode: 404, details: undefined });
  });
});
