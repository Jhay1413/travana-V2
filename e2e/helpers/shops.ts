/**
 * A small world for the access specs: one agency with two shops, a deal (with children and a booking) in the
 * SECOND shop made by shop 2's agent, and an unrelated second agency with its own deal. The browser page is left
 * signed in as shop 1's agent; use signIn() to switch.
 */
import type { Page } from "@playwright/test";
import { apiCreateClient, dataOf, signIn } from "./deals";
import { bookedDeal, boardWorld, enquiryDeal, quoteDeal, type BoardWorld, type Deal } from "./pipeline";
import { makeSecondBranch, queryRows, seedDealsAgency, seedMember, type DealsAgency } from "./seed";

export interface ShopsWorld {
  /** Shop 1 (the agent signed in at the start). */
  w: BoardWorld;
  agency: DealsAgency;
  branch2Id: string;
  agent2: { id: string; email: string };
  manager1: { id: string; email: string };
  /** A quote deal in shop 2, with one flight, one transfer and one accommodation on its main quote. */
  deal2: Deal & { clientId: string; flightId: string; transferId: string; accommodationId: string };
  /** A booked deal in shop 2. */
  booked2: Deal & { bookingId: string; clientId: string };
  /** An enquiry deal in shop 2. */
  enquiry2: Deal & { clientId: string };
  /** Another agency: its admin, a quote deal and a booked deal. */
  foreign: { adminEmail: string; agentEmail: string; quote: Deal; bookingId: string };
}

export async function shopsWorld(page: Page): Promise<ShopsWorld> {
  const w = await boardWorld(page); // signed in as shop 1's agent
  const agency = w.agency;
  const branch2 = await makeSecondBranch(agency.orgId);
  const manager1 = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager", firstName: "Mona", lastName: "Manager" });
  const agent2 = await seedMember({ orgId: agency.orgId, branchId: branch2.id, orgRole: "agent", firstName: "Sam", lastName: "Secondshop" });

  await signIn(page, agent2.email);
  const world2: BoardWorld = { ...w, userId: agent2.id };
  const r = agency.ref;
  const client2 = await apiCreateClient(page.request);
  const q2 = await quoteDeal(
    page.request,
    world2,
    {
      title: "Shop 2 deal",
      extra: {
        outboundFlight: { departing_airport_id: r.airport, arrival_airport_id: r.airport2, departure_date_time: "2027-06-14T07:30:00", arrival_date_time: "2027-06-14T11:45:00", flight_number: "ORIG1" },
        primaryAccommodation: { accomodation_id: r.accommodation, board_basis_id: r.boardBasis, room_type: "ORIG-ROOM", no_of_nights: 7, check_in_date_time: "2027-06-14T15:00:00" },
        transfers: [{ pick_up_location: "A", drop_off_location: "B", cost: "40.00", commission: "4.00", is_included_in_package: false }],
      },
    },
    client2.id,
  );
  const one = async (table: string) => (await queryRows<{ id: string }>(`select id from ${table} where quote_id = $1`, [q2.entityId]))[0].id;
  const deal2 = { ...q2, clientId: client2.id, flightId: await one("quote_flights"), transferId: await one("quote_transfers"), accommodationId: await one("quote_accomodation") };

  const bookedClient = await apiCreateClient(page.request);
  const b2 = await bookedDeal(page.request, world2, { title: "Shop 2 booking" }, bookedClient.id);
  const [{ id: bookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [b2.transactionId]);
  const enquiryClient = await apiCreateClient(page.request);
  const e2 = await enquiryDeal(page.request, world2, "Shop 2 enquiry", {}, enquiryClient.id);

  const foreignAgency = await seedDealsAgency();
  const foreignUser = await signIn(page, foreignAgency.agentEmail);
  const foreignClient = await apiCreateClient(page.request);
  const fw: BoardWorld = { ...w, agency: foreignAgency, userId: foreignUser, clientId: foreignClient.id };
  const fq = await quoteDeal(page.request, fw, { title: "Foreign quote" }, foreignClient.id);
  const fb = await bookedDeal(page.request, fw, { title: "Foreign booking" }, foreignClient.id);
  const [{ id: foreignBookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [fb.transactionId]);

  await signIn(page, agency.agentEmail);
  return {
    w,
    agency,
    branch2Id: branch2.id,
    agent2,
    manager1,
    deal2,
    booked2: { ...b2, bookingId, clientId: bookedClient.id },
    enquiry2: { ...e2, clientId: enquiryClient.id },
    foreign: { adminEmail: foreignAgency.adminEmail, agentEmail: foreignAgency.agentEmail, quote: fq, bookingId: foreignBookingId },
  };
}

/** A quote's own gallery rows, straight from the database. */
export async function quoteImageRows(quoteId: string) {
  return queryRows<{ id: string; url: string; is_primary: boolean; position: number }>(
    `select id, url, is_primary, position from quote_images where quote_id = $1 order by position, id`,
    [quoteId],
  );
}

export async function bookingImageRows(bookingId: string) {
  return queryRows<{ id: string; url: string }>(`select id, url from booking_images where booking_id = $1 order by position, id`, [bookingId]);
}

export { dataOf };
