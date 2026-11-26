import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal-quotes.repository", () => ({
  portalQuotesRepository: {
    findClientQuotes: vi.fn(),
    findAccessByToken: vi.fn(),
    findLiveBookingIdsForQuote: vi.fn(),
    findDecisionActions: vi.fn(),
  },
}));
vi.mock("./portal.repository", () => ({
  portalRepository: { findImagesForQuotes: vi.fn(), findClientNameById: vi.fn(), findClientOrg: vi.fn() },
}));
vi.mock("../quote/quote-public.repository", () => ({
  quotePublicRepository: { findByToken: vi.fn(), setToken: vi.fn() },
}));
vi.mock("../quote/quote-public.service", () => ({
  quotePublicService: { handleCustomerAction: vi.fn() },
}));

import { portalQuotesService, ACTION_TYPE } from "./portal-quotes.service";
import { portalQuotesRepository } from "./portal-quotes.repository";
import { portalRepository } from "./portal.repository";
import { quotePublicRepository } from "../quote/quote-public.repository";
import { quotePublicService } from "../quote/quote-public.service";
import type { PortalQuoteAccessRow, PortalQuoteListRow } from "./portal-quotes.types";

const repo = vi.mocked(portalQuotesRepository);
const portalRepo = vi.mocked(portalRepository);
const publicRepo = vi.mocked(quotePublicRepository);
const publicService = vi.mocked(quotePublicService);

const access = (over: Partial<PortalQuoteAccessRow> = {}): PortalQuoteAccessRow => ({
  quoteId: "q1",
  ownerClientId: "me",
  isPublishedDeal: false,
  isBooked: false,
  operatorName: "Sun Tours",
  dateExpiry: null,
  sentAt: null,
  ...over,
});

const listRow: PortalQuoteListRow = {
  quoteId: "q1", title: "Rome", salesPrice: "1000", discounts: "100", serviceCharge: "50", extrasTotal: 200,
  adult: 2, child: 0, infant: 0, travelDate: "2026-12-01", numNights: 7, dateExpiry: null, sentAt: null, quoteToken: "TOK1",
  operatorName: "Sun Tours", boardName: "All Inclusive", accommodationName: "Hotel Roma", destinationName: "Rome", countryName: "Italy",
};

/** Public quote data with a few cost-side fields on it, as the real record carries. */
const publicData = {
  transactionId: "t1", clientName: "Pat P", agentUserId: "u1", title: "Rome", holidayType: "Package", travelDate: "2026-12-01",
  numNights: 7, adults: 2, children: 0, infants: 0, pets: 0, salesPrice: "1000", discounts: "100", serviceCharge: "50",
  extrasTotal: "200", pricePerPerson: "0", transferType: "none", flightMeals: false, preBookedSeats: "", destinationName: "Rome",
  countryName: "Italy", resortName: "", tags: ["City"], flights: [], accommodations: [], transfers: [], carHires: [],
  attractionTickets: [], loungePasses: [], airportParkings: [], cruises: [], passengers: [], images: [], destinationGuru: null,
  agent: { name: "Sam Agent", avatar: null },
};

const decided = (quoteId: string, actionType: string, createdAt: Date, over: object = {}) => ({
  quoteId, actionType, message: null, reason: null, wantsSimilar: null, createdAt, ...over,
});

const created = (quoteId: string, actionType: string, over: object = {}) => ({
  id: "a1", quoteId, actionType, message: null, customerName: "Pat Portal", createdAt: new Date(), reason: null, wantsSimilar: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.findDecisionActions.mockResolvedValue([]);
  portalRepo.findImagesForQuotes.mockResolvedValue([]);
  portalRepo.findClientNameById.mockResolvedValue({ firstName: "Pat", lastName: "Portal" });
  portalRepo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
  publicRepo.findByToken.mockResolvedValue(publicData as never);
  publicService.handleCustomerAction.mockImplementation(async (_t, type) => created("q1", type) as never);
});

describe("listQuotes", () => {
  it("asks only for this customer's quotes and maps the contract, with the real expiry (null when absent)", async () => {
    repo.findClientQuotes.mockResolvedValue([listRow, { ...listRow, quoteId: "q2", quoteToken: "TOK2", dateExpiry: new Date("2026-12-24T00:00:00Z") }]);
    const items = await portalQuotesService.listQuotes("me");
    expect(repo.findClientQuotes).toHaveBeenCalledWith("me");
    expect(items[0]).toMatchObject({
      id: "q1", token: "TOK1", title: "Rome", destination: "Rome, Italy", hotel: "Hotel Roma", operator_name: "Sun Tours",
      price: 1150, // 1000 - 100 + 50 + 200 extras
      price_per_person: 575,
      nights: 7, board: "All Inclusive", expiry_date: null, quote_url: "/portal/quote/TOK1", return_date: "2026-12-08",
    });
    expect(items[0].decision.state).toBe("none");
    expect(items[1].expiry_date).toBe("2026-12-24T00:00:00.000Z");
  });

  it("never invents nights or a return date: a quote with no length has neither", async () => {
    repo.findClientQuotes.mockResolvedValue([{ ...listRow, numNights: null }, { ...listRow, quoteId: "q2", quoteToken: "TOK2", numNights: 0 }]);
    const items = await portalQuotesService.listQuotes("me");
    for (const item of items) expect(item).toMatchObject({ nights: null, return_date: null });
  });

  it("never invents an expiry date", async () => {
    repo.findClientQuotes.mockResolvedValue([listRow]);
    const [item] = await portalQuotesService.listQuotes("me");
    expect(item.expiry_date).toBeNull();
  });

  it("gives a quote with no token a new one", async () => {
    repo.findClientQuotes.mockResolvedValue([{ ...listRow, quoteToken: null }]);
    publicRepo.setToken.mockResolvedValue("NEW1");
    const [item] = await portalQuotesService.listQuotes("me");
    expect(item.token).toBe("NEW1");
    expect(item.quote_url).toBe("/portal/quote/NEW1");
  });

  it("carries the lead image, photo count and each quote's latest decision", async () => {
    repo.findClientQuotes.mockResolvedValue([listRow, { ...listRow, quoteId: "q2", quoteToken: "TOK2" }]);
    portalRepo.findImagesForQuotes.mockResolvedValue([
      { quoteId: "q1", url: "a.jpg", isPrimary: false },
      { quoteId: "q1", url: "b.jpg", isPrimary: true },
      { quoteId: "q1", url: "b.jpg", isPrimary: false },
    ]);
    repo.findDecisionActions.mockResolvedValue([
      decided("q2", "declined", new Date("2026-11-24T10:00:00Z"), { message: "Too far", reason: "Wrong dates", wantsSimilar: true }),
      decided("q2", "accepted", new Date("2026-11-23T10:00:00Z")),
      decided("q1", "accepted", new Date("2026-11-22T10:00:00Z"), { message: "Lovely" }),
    ]);
    const [a, b] = await portalQuotesService.listQuotes("me");
    expect(a).toMatchObject({ image_url: "b.jpg", photo_count: 2 });
    expect(a.decision).toMatchObject({ state: "interested", note: "Lovely" });
    expect(b.decision).toMatchObject({ state: "declined", reason: "Wrong dates", wantsSimilar: true, note: "Too far" });
  });

  it("an empty list stays empty", async () => {
    repo.findClientQuotes.mockResolvedValue([]);
    expect(await portalQuotesService.listQuotes("me")).toEqual([]);
  });
});

describe("getQuote: who may read it", () => {
  it("returns the quote to its owner, with the customer total and the real expiry/sent dates", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ dateExpiry: new Date("2026-12-24T00:00:00Z"), sentAt: new Date("2026-11-20T09:00:00Z") }));
    const q = await portalQuotesService.getQuote("me", "TOK1");
    expect(q).toMatchObject({
      id: "q1", token: "TOK1", total: 1150, pricePerPerson: 575, operatorName: "Sun Tours",
      expiryDate: "2026-12-24T00:00:00.000Z", sentAt: "2026-11-20T09:00:00.000Z", canDecide: true, canShare: true,
    });
  });

  it("looks the token up for the customer's own agency", async () => {
    repo.findAccessByToken.mockResolvedValue(access());
    await portalQuotesService.getQuote("me", "TOK1");
    expect(portalRepo.findClientOrg).toHaveBeenCalledWith("me");
    expect(repo.findAccessByToken).toHaveBeenCalledWith("TOK1", "org-a");
  });

  it("expiry is null when the quote has none", async () => {
    repo.findAccessByToken.mockResolvedValue(access());
    expect((await portalQuotesService.getQuote("me", "TOK1")).expiryDate).toBeNull();
  });

  it("is a 404 (not a 403) for a quote that belongs to someone else", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: "someone-else" }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404 });
    expect(publicRepo.findByToken).not.toHaveBeenCalled();
  });

  it("is a 404 for a token that is not visible to customers (missing, deleted, dead deal, test deal)", async () => {
    repo.findAccessByToken.mockResolvedValue(null);
    await expect(portalQuotesService.getQuote("me", "NOPE")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a published deal of the customer's own agency can be read, but not decided on", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: null, isPublishedDeal: true }));
    repo.findDecisionActions.mockResolvedValue([decided("q1", "accepted", new Date())]);
    const q = await portalQuotesService.getQuote("me", "TOK1");
    expect(q.canDecide).toBe(false);
    expect(q.decision.state).toBe("none"); // somebody else's decision is never shown
    expect(repo.findDecisionActions).not.toHaveBeenCalled();
  });

  it("a deal of ANOTHER agency is a 404 (the repository reports it as not published for this customer)", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: null, isPublishedDeal: false }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a customer with no agency reads no deals: the lookup is made with a null organisation", async () => {
    portalRepo.findClientOrg.mockResolvedValue({ orgId: null });
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: null, isPublishedDeal: false }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findAccessByToken).toHaveBeenCalledWith("TOK1", null);
  });

  it("an unpublished quote with no owner is not readable", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: null, isPublishedDeal: false }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("shows the owner's latest decision", async () => {
    repo.findAccessByToken.mockResolvedValue(access());
    repo.findDecisionActions.mockResolvedValue([decided("q1", "declined", new Date("2026-11-24T10:00:00Z"), { reason: "Too expensive", wantsSimilar: false })]);
    expect((await portalQuotesService.getQuote("me", "TOK1")).decision).toMatchObject({ state: "declined", reason: "Too expensive", wantsSimilar: false });
  });
});

describe("getQuote: Share is only for the customer's own quote or a deal with no real customer on it", () => {
  it("owner: yes", async () => {
    repo.findAccessByToken.mockResolvedValue(access());
    expect((await portalQuotesService.getQuote("me", "TOK1")).canShare).toBe(true);
  });

  it("a published deal with no customer attached: yes", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: null, isPublishedDeal: true }));
    expect((await portalQuotesService.getQuote("me", "TOK1")).canShare).toBe(true);
  });

  it("a published deal that belongs to a real customer: never (the public page names the client)", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: "someone-else", isPublishedDeal: true }));
    const q = await portalQuotesService.getQuote("me", "TOK1");
    expect(q.canShare).toBe(false);
    expect(q.canDecide).toBe(false);
  });
});

/** Every key anywhere in a value, so a forbidden one cannot hide in a nested object. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}
const FORBIDDEN = /profit|commission|cost|supplier|margin|net(price|amount)?$|salesPrice|sales_price|discount|serviceCharge|service_charge|agentUserId|transactionId|clientName|passengers/i;

describe("the allowlist: no cost-side data reaches the customer", () => {
  it("the list has no profit, commission, cost or supplier key", async () => {
    repo.findClientQuotes.mockResolvedValue([listRow]);
    const keys = [...allKeys(await portalQuotesService.listQuotes("me"))];
    expect(keys.filter((k) => FORBIDDEN.test(k))).toEqual([]);
  });

  it("the detail has none either, even when the source record carries them", async () => {
    repo.findAccessByToken.mockResolvedValue(access());
    publicRepo.findByToken.mockResolvedValue({
      ...publicData,
      profit: 123, commission: 45, netCost: 800, supplierCost: 700, supplierRef: "S-1", costPrice: 600,
      accommodations: [{ name: "Hotel", boardBasis: "BB", roomType: "Double", checkInDateTime: null, starRating: "5", resortName: "", netPrice: 9, supplierCost: 9 }],
      flights: [{ flightType: "outbound", flightNumber: "BA1", departingAirport: "LHR", arrivalAirport: "FCO", departureDateTime: null, arrivalDateTime: null, airline: "", legOrder: 1, cost: 5 }],
    } as never);
    const q = await portalQuotesService.getQuote("me", "TOK1");
    expect([...allKeys(q)].filter((k) => FORBIDDEN.test(k))).toEqual([]);
    expect(JSON.stringify(q)).not.toMatch(/123|800|700|S-1|600/);
    expect(q.accommodations[0]).not.toHaveProperty("starRating");
  });
});

describe("recordAction: who and what", () => {
  it("maps 'interested' to the existing accept action value exactly", () => {
    expect(ACTION_TYPE.interested).toBe("accepted");
    expect(ACTION_TYPE.declined).toBe("declined");
    expect(ACTION_TYPE.reopened).toBe("reopened");
  });

  it("is a 404 for another customer's quote and for one not visible to customers, and writes nothing", async () => {
    for (const row of [access({ ownerClientId: "someone-else" }), null]) {
      repo.findAccessByToken.mockResolvedValue(row);
      await expect(portalQuotesService.recordAction("me", "TOK1", { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
  });

  it("a published deal that is not theirs cannot be acted on either", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: null, isPublishedDeal: true }));
    await expect(portalQuotesService.recordAction("me", "TOK1", { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("'interested' goes through handleCustomerAction as 'accepted' with the optional note and the name from the session", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-interested" }));
    publicService.handleCustomerAction.mockResolvedValue(created("q-interested", "accepted", { message: "A sea view please" }) as never);
    const res = await portalQuotesService.recordAction("me", "TOK1", { action: "interested", note: "  A sea view please  " });
    expect(portalRepo.findClientNameById).toHaveBeenCalledWith("me");
    expect(publicService.handleCustomerAction).toHaveBeenCalledWith("TOK1", "accepted", "A sea view please", "Pat Portal", undefined);
    expect(res.decision).toMatchObject({ state: "interested", note: "A sea view please" });
  });

  it("an empty note is stored as none", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-empty-note" }));
    await portalQuotesService.recordAction("me", "TOK1", { action: "interested", note: "   " });
    expect(publicService.handleCustomerAction).toHaveBeenCalledWith("TOK1", "accepted", null, "Pat Portal", undefined);
  });

  it("'declined' carries the reason and the similar flag the customer sent", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-declined-1" }));
    publicService.handleCustomerAction.mockResolvedValue(created("q-declined-1", "declined", { reason: "Too expensive", wantsSimilar: true }) as never);
    const res = await portalQuotesService.recordAction("me", "TOK1", { action: "declined", reason: "Too expensive", wantsSimilar: true });
    expect(publicService.handleCustomerAction).toHaveBeenCalledWith("TOK1", "declined", null, "Pat Portal", { reason: "Too expensive", wantsSimilar: true });
    expect(res.decision).toMatchObject({ state: "declined", reason: "Too expensive", wantsSimilar: true });
  });

  it("'declined' with the flag absent from the request records false (the screen always sends it)", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-declined-2" }));
    publicService.handleCustomerAction.mockResolvedValue(created("q-declined-2", "declined", { wantsSimilar: false }) as never);
    await portalQuotesService.recordAction("me", "TOK1", { action: "declined" });
    expect(publicService.handleCustomerAction).toHaveBeenCalledWith("TOK1", "declined", null, "Pat Portal", { reason: null, wantsSimilar: false });
  });

  it("rejects a reason that is not one of the fixed chips", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-bad-reason" }));
    await expect(portalQuotesService.recordAction("me", "TOK1", { action: "declined", reason: "Because I said so" })).rejects.toMatchObject({ statusCode: 400 });
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
  });

  it("ignores a reason sent with an action that is not a decline", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-reason-ignored" }));
    await portalQuotesService.recordAction("me", "TOK1", { action: "interested", reason: "nonsense" });
    expect(publicService.handleCustomerAction).toHaveBeenCalledWith("TOK1", "accepted", null, "Pat Portal", undefined);
  });
});

describe("recordAction: idempotent by state, never by time", () => {
  it("'reopened' undoes a decline: it is recorded, and the decision goes back to none", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-reopen" }));
    repo.findDecisionActions.mockResolvedValue([decided("q-reopen", "declined", new Date(Date.now() - 60_000), { reason: "Wrong dates", wantsSimilar: true })]);
    publicService.handleCustomerAction.mockResolvedValue(created("q-reopen", "reopened") as never);
    const res = await portalQuotesService.recordAction("me", "TOK1", { action: "reopened" });
    expect(publicService.handleCustomerAction).toHaveBeenCalledWith("TOK1", "reopened", null, "Pat Portal", undefined);
    expect(res.decision.state).toBe("none");
  });

  it("'reopened' on a quote that is not declined changes nothing", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-reopen-noop" }));
    expect((await portalQuotesService.recordAction("me", "TOK1", { action: "reopened" })).decision.state).toBe("none");
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-reopen-noop-2" }));
    repo.findDecisionActions.mockResolvedValue([decided("q-reopen-noop-2", "accepted", new Date())]);
    expect((await portalQuotesService.recordAction("me", "TOK1", { action: "reopened" })).decision.state).toBe("interested");
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
  });

  it("interested when the latest decision is already interested returns it without writing or notifying, even minutes later", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-twice" }));
    repo.findDecisionActions.mockResolvedValue([decided("q-twice", "accepted", new Date(Date.now() - 10 * 60_000), { message: "Lovely" })]);
    const res = await portalQuotesService.recordAction("me", "TOK1", { action: "interested", note: "again" });
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
    expect(res.decision).toMatchObject({ state: "interested", note: "Lovely" });
  });

  it("declined when already declined is a no-op too", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-twice-d" }));
    repo.findDecisionActions.mockResolvedValue([decided("q-twice-d", "declined", new Date(Date.now() - 3_600_000), { reason: "Wrong dates", wantsSimilar: true })]);
    const res = await portalQuotesService.recordAction("me", "TOK1", { action: "declined", reason: "Too expensive" });
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
    expect(res.decision).toMatchObject({ state: "declined", reason: "Wrong dates" });
  });

  it("decline, undo, decline in quick succession writes three records, each returning its own decision", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-flip" }));
    const stored: ReturnType<typeof decided>[] = [];
    repo.findDecisionActions.mockImplementation(async () => [...stored].reverse());
    publicService.handleCustomerAction.mockImplementation(async (_t, type, _m, _n, details) => {
      const row = decided("q-flip", type, new Date(), { reason: details?.reason ?? null, wantsSimilar: details?.wantsSimilar ?? null });
      stored.push(row);
      return { id: "x", customerName: "Pat Portal", message: null, ...row } as never;
    });
    const first = await portalQuotesService.recordAction("me", "TOK1", { action: "declined", reason: "Too expensive", wantsSimilar: true });
    const undo = await portalQuotesService.recordAction("me", "TOK1", { action: "reopened" });
    const again = await portalQuotesService.recordAction("me", "TOK1", { action: "declined", reason: "Too expensive", wantsSimilar: true });
    expect([first.decision.state, undo.decision.state, again.decision.state]).toEqual(["declined", "none", "declined"]);
    expect(publicService.handleCustomerAction).toHaveBeenCalledTimes(3);
    expect(stored.map((r) => r.actionType)).toEqual(["declined", "reopened", "declined"]);
  });

  it("two identical requests at the same moment write once, and both get the written decision", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-concurrent" }));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    publicService.handleCustomerAction.mockImplementation(async () => {
      await gate;
      return created("q-concurrent", "accepted") as never;
    });
    const a = portalQuotesService.recordAction("me", "TOK1", { action: "interested" });
    const b = portalQuotesService.recordAction("me", "TOK1", { action: "interested" });
    await new Promise((r) => setTimeout(r, 10));
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(publicService.handleCustomerAction).toHaveBeenCalledTimes(1);
    expect(ra.decision.state).toBe("interested");
    expect(rb.decision).toEqual(ra.decision);
  });

  it("a failed save can be retried straight away", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ quoteId: "q-retry" }));
    publicService.handleCustomerAction.mockRejectedValueOnce(new Error("db down"));
    await expect(portalQuotesService.recordAction("me", "TOK1", { action: "interested" })).rejects.toThrow("db down");
    await portalQuotesService.recordAction("me", "TOK1", { action: "interested" });
    expect(publicService.handleCustomerAction).toHaveBeenCalledTimes(2);
  });
});

describe("checkOwnership", () => {
  it("keeps the original shape; the published-deal flag is the same-agency rule", async () => {
    repo.findAccessByToken.mockResolvedValue(access({ isPublishedDeal: true }));
    expect(await portalQuotesService.checkOwnership("me", "TOK1")).toEqual({ found: true, owns: true, isPublicDeal: true });
    expect(repo.findAccessByToken).toHaveBeenCalledWith("TOK1", "org-a");
    repo.findAccessByToken.mockResolvedValue(access({ ownerClientId: "x", isPublishedDeal: false }));
    expect(await portalQuotesService.checkOwnership("me", "TOK1")).toEqual({ found: true, owns: false, isPublicDeal: false });
    repo.findAccessByToken.mockResolvedValue(null);
    expect(await portalQuotesService.checkOwnership("me", "NOPE")).toEqual({ found: false, owns: false, isPublicDeal: false });
  });
});

describe("a quote whose deal is booked", () => {
  const booked = (over: Partial<PortalQuoteAccessRow> = {}) => access({ isBooked: true, ...over });
  beforeEach(() => repo.findLiveBookingIdsForQuote.mockResolvedValue([]));

  it("names the booking in the owner's 410 when the deal has exactly one live booking, and not otherwise", async () => {
    repo.findAccessByToken.mockResolvedValue(booked());
    repo.findLiveBookingIdsForQuote.mockResolvedValue(["bk-1"]);
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 410, code: "BOOKED", details: { bookingId: "bk-1" } });
    repo.findLiveBookingIdsForQuote.mockResolvedValue(["bk-1", "bk-2"]);
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 410, details: undefined });
    repo.findLiveBookingIdsForQuote.mockResolvedValue([]);
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 410, details: undefined });
  });

  it("never looks for a booking for a non-owner: a plain 404", async () => {
    repo.findAccessByToken.mockResolvedValue(booked({ ownerClientId: "someone-else", isPublishedDeal: false }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404, details: undefined });
    expect(repo.findLiveBookingIdsForQuote).not.toHaveBeenCalled();
  });

  it("answers its owner with 410 and the BOOKED code, on detail and on view logging's readable check", async () => {
    repo.findAccessByToken.mockResolvedValue(booked());
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 410, code: "BOOKED", message: "This holiday is booked" });
    await expect(portalQuotesService.getReadable("me", "TOK1")).rejects.toMatchObject({ statusCode: 410, code: "BOOKED" });
    expect(publicRepo.findByToken).not.toHaveBeenCalled();
  });

  it("is still a plain 404 for anyone who is not the owner (and not a same-agency published deal)", async () => {
    repo.findAccessByToken.mockResolvedValue(booked({ ownerClientId: "someone-else", isPublishedDeal: false }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404, message: "Quote not found" });
    repo.findAccessByToken.mockResolvedValue(booked({ ownerClientId: null, isPublishedDeal: false }));
    await expect(portalQuotesService.getQuote("me", "TOK1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a published deal of the customer's agency that belongs to someone else stays readable (the deals rule decides)", async () => {
    repo.findAccessByToken.mockResolvedValue(booked({ ownerClientId: "someone-else", isPublishedDeal: true }));
    const r = await portalQuotesService.getReadable("me", "TOK1");
    expect(r.owns).toBe(false);
  });

  it("refuses every action on it, writing and notifying nothing", async () => {
    repo.findAccessByToken.mockResolvedValue(booked());
    for (const action of ["interested", "declined", "reopened"] as const) {
      await expect(portalQuotesService.recordAction("me", "TOK1", { action })).rejects.toMatchObject({ statusCode: 410, code: "BOOKED" });
    }
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
  });
});

describe("a quote staff marked lost or archived, or with no status", () => {
  // The status rule lives in the repository's visibility predicate (asserted in portal-quotes.repository.test.ts):
  // such a quote is simply not found, so every path answers the same 404 as for a token that does not exist.
  it("is a 404 for reading, acting and the ownership check", async () => {
    repo.findAccessByToken.mockResolvedValue(null);
    await expect(portalQuotesService.getQuote("me", "LOST")).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalQuotesService.recordAction("me", "LOST", { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
    expect(await portalQuotesService.checkOwnership("me", "LOST")).toEqual({ found: false, owns: false, isPublicDeal: false });
    expect(publicService.handleCustomerAction).not.toHaveBeenCalled();
  });

  it("a quote with no status is read as normal", async () => {
    repo.findAccessByToken.mockResolvedValue(access());
    repo.findDecisionActions.mockResolvedValue([]);
    publicRepo.findByToken.mockResolvedValue(publicData as never);
    await expect(portalQuotesService.getQuote("me", "TOK1")).resolves.toMatchObject({ canDecide: true });
  });
});
