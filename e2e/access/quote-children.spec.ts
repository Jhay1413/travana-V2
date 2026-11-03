/**
 * Access rules for the quote child endpoints (flights, accommodations, transfers, passengers).
 *
 * A child row is reachable only through its OWN quote: the quote in the path must pass the same shop scope as
 * quote writes (otherwise 404), the child must belong to that quote (otherwise 404), and a social media manager
 * is refused (403) on any child of a deal quote, judged by the quote that owns the child and not by the :id in
 * the path. Each case has a control test showing the same call is refused or accepted where it should be.
 */
import type { APIRequestContext, Page } from "@playwright/test";
import { apiCreateClient, dataOf, quotePayload, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { boardWorld, bookedDeal, quoteDeal, type BoardWorld, type Deal } from "../helpers/pipeline";
import { queryRows, seedHomeworker, seedMember } from "../helpers/seed";

interface Kids {
  quoteId: string;
  transactionId: string;
  flightId: string;
  accommodationId: string;
  transferId: string;
  passengerId: string;
}

/** A deal made by whoever `page` is signed in as, with one flight, accommodation, transfer and passenger on its main quote. */
async function dealWithChildren(page: Page, w: BoardWorld, title: string, clientId = w.clientId): Promise<Kids> {
  const r = w.agency.ref;
  const deal: Deal = await quoteDeal(
    page.request,
    w,
    {
      title,
      extra: {
        outboundFlight: {
          departing_airport_id: r.airport,
          arrival_airport_id: r.airport2,
          departure_date_time: "2027-06-14T07:30:00",
          arrival_date_time: "2027-06-14T11:45:00",
          flight_number: "ORIG1",
        },
        primaryAccommodation: { accomodation_id: r.accommodation, board_basis_id: r.boardBasis, room_type: "ORIG-ROOM", no_of_nights: 7, check_in_date_time: "2027-06-14T15:00:00" },
        transfers: [{ pick_up_location: "A", drop_off_location: "B", cost: "40.00", commission: "4.00", is_included_in_package: false }],
      },
    },
    clientId,
  );
  const passenger = await page.request.post(`/api/v2/quotes/${deal.entityId}/passengers`, { data: { type: "child", age: 6 } });
  const passengerId = (await dataOf<{ id: string }>(passenger, 201)).id;
  const one = async (table: string) => (await queryRows<{ id: string }>(`select id from ${table} where quote_id = $1`, [deal.entityId]))[0].id;
  return {
    quoteId: deal.entityId,
    transactionId: deal.transactionId,
    flightId: await one("quote_flights"),
    accommodationId: await one("quote_accomodation"),
    transferId: await one("quote_transfers"),
    passengerId,
  };
}

const flightNumber = async (id: string) => (await queryRows<{ n: string | null }>(`select flight_number n from quote_flights where id = $1`, [id]))[0]?.n;
const roomType = async (id: string) => (await queryRows<{ n: string | null }>(`select room_type n from quote_accomodation where id = $1`, [id]))[0]?.n;
const exists = async (table: string, id: string) => (await queryRows(`select 1 from ${table} where id = $1`, [id])).length === 1;

type Call = (request: APIRequestContext, quoteIdInPath: string, k: Kids) => ReturnType<APIRequestContext["patch"]>;
interface Kind {
  name: string;
  call: Call;
  /** True when the row is exactly as it was created. */
  untouched: (k: Kids) => Promise<boolean>;
}

const KINDS: Kind[] = [
  {
    name: "edit a flight",
    call: (req, q, k) => req.patch(`/api/v2/quotes/${q}/flights/${k.flightId}`, { data: { flight_number: "HACKED" } }),
    untouched: async (k) => (await flightNumber(k.flightId)) === "ORIG1",
  },
  {
    name: "edit an accommodation",
    call: (req, q, k) => req.patch(`/api/v2/quotes/${q}/accommodations/${k.accommodationId}`, { data: { room_type: "HACKED" } }),
    untouched: async (k) => (await roomType(k.accommodationId)) === "ORIG-ROOM",
  },
  {
    name: "delete a transfer",
    call: (req, q, k) => req.delete(`/api/v2/quotes/${q}/transfers/${k.transferId}`),
    untouched: (k) => exists("quote_transfers", k.transferId),
  },
  {
    name: "delete a passenger",
    call: (req, q, k) => req.delete(`/api/v2/quotes/${q}/passengers/${k.passengerId}`),
    untouched: (k) => exists("passengers", k.passengerId),
  },
  {
    name: "delete a flight",
    call: (req, q, k) => req.delete(`/api/v2/quotes/${q}/flights/${k.flightId}`),
    untouched: (k) => exists("quote_flights", k.flightId),
  },
];

/** Prints what actually happened, so a failing assertion shows the real status and whether the row changed. */
async function observe(label: string, res: { status(): number }, kind: Kind, k: Kids) {
  const line = `OBSERVED ${label} | ${kind.name} -> HTTP ${res.status()}, row changed or gone: ${!(await kind.untouched(k))}`;
  console.log(line);
  test.info().annotations.push({ type: "observed", description: line });
}

/** The same deal holds up when addressed correctly: this is what each "attack" below is compared with. */
async function expectChanged(kind: Kind, k: Kids) {
  expect(await kind.untouched(k), `${kind.name}: the row should be changed after a permitted call`).toBe(false);
}

test.describe("A. a social media manager and another deal's children", () => {
  async function build(page: Page) {
    const w = await boardWorld(page); // signed in as agent A
    const deal = await dealWithChildren(page, w, "Deal with children");
    const smm = await seedMember({ orgId: w.agency.orgId, branchId: w.agency.branchId, orgRole: "social_media_manager" });
    await signIn(page, smm.email);
    // Their own free (social) quote, made the way the app makes it.
    const free = await dataOf<{ id: string }>(await page.request.post("/api/v2/quotes/social-post", { data: quotePayload(w.agency, { title: "Social post" }) }), 201);
    return { w, deal, freeQuoteId: free.id };
  }

  test("control: the guard refuses the social media manager when the path names the deal's own quote (403, row unchanged)", async ({ page }) => {
    const { deal } = await build(page);
    for (const kind of KINDS) {
      const res = await kind.call(page.request, deal.quoteId, deal);
      expect(res.status(), kind.name).toBe(403);
      expect(await kind.untouched(deal), `${kind.name}: row unchanged`).toBe(true);
    }
  });

  test("control: the social media manager may edit their own free quote (200)", async ({ page }) => {
    const { freeQuoteId } = await build(page);
    const res = await page.request.patch(`/api/v2/quotes/${freeQuoteId}`, { data: { title: "Social post edited" } });
    expect(res.status(), await res.text()).toBe(200);
  });

  for (const kind of KINDS) {
    test(`they cannot ${kind.name} of a deal by naming their own free quote in the path (403, row unchanged)`, async ({ page }) => {
      const { deal, freeQuoteId } = await build(page);
      const res = await kind.call(page.request, freeQuoteId, deal);
      await observe(test.info().title, res, kind, deal);
      expect(res.status()).toBe(403);
      expect(await kind.untouched(deal)).toBe(true);
    });
  }
});

test.describe("B. shop and homeworker partitions", () => {
  async function build(page: Page) {
    const w = await boardWorld(page); // agent A of the shop
    const shop = await dealWithChildren(page, w, "Shop deal");
    const hw = await seedHomeworker(w.agency.orgId);
    const hwUserId = await signIn(page, hw.email);
    const hwClient = await apiCreateClient(page.request);
    const hwWorld: BoardWorld = { ...w, userId: hwUserId, clientId: hwClient.id };
    const hwDeal = await dealWithChildren(page, hwWorld, "Homeworker deal", hwClient.id);
    return { w, shop, hw, hwDeal };
  }

  test("control: the partition holds on the quote itself, and a caller may change their own children (agent -> homeworker quote 404; own flight 200)", async ({ page }) => {
    const { w, shop, hwDeal } = await build(page);
    await signIn(page, w.agency.agentEmail);
    const quoteLevel = await page.request.patch(`/api/v2/quotes/${hwDeal.quoteId}`, { data: { title: "x" } });
    expect(quoteLevel.status(), "the quote endpoints keep shop staff out of a homeworker deal").toBe(404);
    const own = await KINDS[0].call(page.request, shop.quoteId, shop);
    expect(own.status(), await own.text()).toBe(200);
    await expectChanged(KINDS[0], shop);
  });

  test("control: a homeworker may change their own flight (200)", async ({ page }) => {
    const { hw, hwDeal } = await build(page);
    await signIn(page, hw.email);
    const res = await KINDS[0].call(page.request, hwDeal.quoteId, hwDeal);
    expect(res.status(), await res.text()).toBe(200);
    await expectChanged(KINDS[0], hwDeal);
  });

  for (const kind of [KINDS[0], KINDS[4]]) {
    test(`shop staff cannot ${kind.name} of a homeworker's deal by its child id (404, row unchanged)`, async ({ page }) => {
      const { w, shop, hwDeal } = await build(page);
      await signIn(page, w.agency.agentEmail);
      const res = await kind.call(page.request, shop.quoteId, hwDeal); // the path names the agent's OWN quote
      await observe(test.info().title, res, kind, hwDeal);
      expect(res.status()).toBe(404);
      expect(await kind.untouched(hwDeal)).toBe(true);
    });

    test(`a homeworker cannot ${kind.name} of a shop deal by its child id (404, row unchanged)`, async ({ page }) => {
      const { hw, shop, hwDeal } = await build(page);
      await signIn(page, hw.email);
      const res = await kind.call(page.request, hwDeal.quoteId, shop); // the path names the homeworker's OWN quote
      await observe(test.info().title, res, kind, shop);
      expect(res.status()).toBe(404);
      expect(await kind.untouched(shop)).toBe(true);
    });
  }
});

test.describe("C. a child addressed through a different quote", () => {
  async function build(page: Page) {
    const w = await boardWorld(page);
    const a = await dealWithChildren(page, w, "Quote A");
    const b = await dealWithChildren(page, w, "Quote B");
    return { a, b };
  }

  test("control: the same call through the flight's own quote edits it (200)", async ({ page }) => {
    const { b } = await build(page);
    const res = await KINDS[0].call(page.request, b.quoteId, b);
    expect(res.status(), await res.text()).toBe(200);
    await expectChanged(KINDS[0], b);
  });

  for (const kind of [KINDS[0], KINDS[2]]) {
    test(`PATCH/DELETE through quote A cannot ${kind.name} that belongs to quote B (404, row unchanged)`, async ({ page }) => {
      const { a, b } = await build(page);
      const res = await kind.call(page.request, a.quoteId, b);
      await observe(test.info().title, res, kind, b);
      expect(res.status()).toBe(404);
      expect(await kind.untouched(b)).toBe(true);
    });
  }
});

test.describe("D. a child can never be moved to another quote or re-keyed from the request body", () => {
  async function build(page: Page) {
    const w = await boardWorld(page);
    const a = await dealWithChildren(page, w, "Quote A");
    const b = await dealWithChildren(page, w, "Quote B");
    return { a, b };
  }
  const quoteOf = async (table: string, id: string) => (await queryRows<{ q: string }>(`select quote_id q from ${table} where id = $1`, [id]))[0]?.q;

  test("PATCH with quote_id or id in the body is refused (400) and the flight and accommodation stay in their quote", async ({ page }) => {
    const { a, b } = await build(page);
    for (const body of [{ quote_id: b.quoteId }, { id: b.flightId }, { flight_number: "X", quote_id: b.quoteId }]) {
      const res = await page.request.patch(`/api/v2/quotes/${a.quoteId}/flights/${a.flightId}`, { data: body });
      expect(res.status(), JSON.stringify(body)).toBe(400);
    }
    for (const body of [{ quote_id: b.quoteId }, { id: b.accommodationId }]) {
      const res = await page.request.patch(`/api/v2/quotes/${a.quoteId}/accommodations/${a.accommodationId}`, { data: body });
      expect(res.status(), JSON.stringify(body)).toBe(400);
    }
    expect(await quoteOf("quote_flights", a.flightId)).toBe(a.quoteId);
    expect(await quoteOf("quote_accomodation", a.accommodationId)).toBe(a.quoteId);
    expect(await flightNumber(a.flightId)).toBe("ORIG1");
  });

  test("adding a child with quote_id or id in the body is refused (400); a normal add still lands in the path's quote", async ({ page }) => {
    const { a, b } = await build(page);
    const bad = await page.request.post(`/api/v2/quotes/${a.quoteId}/flights`, { data: { flight_number: "NEW", quote_id: b.quoteId } });
    expect(bad.status()).toBe(400);
    const badTransfer = await page.request.post(`/api/v2/quotes/${a.quoteId}/transfers`, { data: { id: b.transferId } });
    expect(badTransfer.status()).toBe(400);
    const good = await page.request.post(`/api/v2/quotes/${a.quoteId}/flights`, { data: { flight_number: "NEW" } });
    expect(good.status(), await good.text()).toBe(201);
    const created = await dataOf<{ id: string }>(good, 201);
    expect(await quoteOf("quote_flights", created.id)).toBe(a.quoteId);
  });

  test("a booking's children reject booking_id and id in the body too", async ({ page }) => {
    const w = await boardWorld(page);
    const d = await bookedDeal(page.request, w, { title: "Booked" });
    const [{ id: bookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [d.transactionId]);
    const otherBooking = "11111111-2222-4333-8444-555555555555";
    const bad = await page.request.post(`/api/v2/bookings/${bookingId}/flights`, { data: { flight_number: "NEW", booking_id: otherBooking } });
    expect(bad.status()).toBe(400);
    const badAcc = await page.request.post(`/api/v2/bookings/${bookingId}/accommodations`, { data: { id: otherBooking } });
    expect(badAcc.status()).toBe(400);
    const good = await page.request.post(`/api/v2/bookings/${bookingId}/flights`, { data: { flight_number: "NEW" } });
    expect(good.status(), await good.text()).toBe(201);
  });
});
