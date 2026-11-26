import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-public.repository", () => ({
  quotePublicRepository: {
    findByToken: vi.fn(),
    findRecordById: vi.fn(),
    findAccessState: vi.fn(),
    findNotifyInfo: vi.fn(),
    findQuoteIdByToken: vi.fn(),
    hasRecentLinkViewNotification: vi.fn(),
    logView: vi.fn(),
    createCustomerAction: vi.fn(),
    notifyAgent: vi.fn(),
  },
}));
vi.mock("./quote-access", () => ({ assertQuoteReadable: vi.fn() }));

import { quotePublicService, blockFor, toPublicPayload } from "./quote-public.service";
import { quotePublicRepository } from "./quote-public.repository";
import { assertQuoteReadable } from "./quote-access";
import { QuoteBlockedError, type QuoteAccessRow } from "./quote-public.types";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const TOKEN = "ABC234";

const openState = (over: Partial<QuoteAccessRow> = {}): QuoteAccessRow => ({
  visible: true,
  isBooked: false,
  clientDeleted: false,
  dateExpiry: null,
  agencyName: "Tinas Travel",
  agencySettings: { profile: { phone: "0191 594 7999" } },
  ...over,
});

/** A record as the repository returns it: full of the things the public payload must never carry. */
function dirtyRecord(over: Record<string, unknown> = {}) {
  return {
    transactionId: "tx-secret",
    clientName: "Jane Smith",
    agentUserId: "agent-secret",
    title: "Lapland",
    holidayType: "Package",
    travelDate: "2026-12-20",
    numNights: 5,
    adults: 2,
    children: 1,
    infants: 0,
    pets: 0,
    salesPrice: "1000",
    discounts: "100",
    serviceCharge: "50",
    extrasTotal: "30",
    pricePerPerson: "999.99",
    transferType: "shared",
    flightMeals: true,
    preBookedSeats: "12A",
    destinationName: "Rovaniemi",
    countryName: "Finland",
    resortName: "Santa Park",
    tags: ["internal-tag"],
    flights: [{ flightType: "outbound", flightNumber: "BA1", departingAirport: "LHR", arrivalAirport: "RVN", departureDateTime: "2026-12-20T09:00:00", arrivalDateTime: "2026-12-20T13:00:00", airline: "", legOrder: 1, id: "f-secret" }],
    accommodations: [{ name: "Hotel", boardBasis: "BB", roomType: "Twin", checkInDateTime: "2026-12-20T15:00:00", starRating: null, resortName: "Santa Park" }],
    transfers: [{ from: "Airport", to: "Hotel", pickUpTime: "10:00", dropOffTime: "11:00", note: "Meet at arrivals" }],
    carHires: [{ pickupLocation: "A", dropoffLocation: "B", pickupTime: "1", dropoffTime: "2", numDays: 3 }],
    attractionTickets: [{ type: "Zoo", dateOfVisit: "2026-12-22", numberOfTickets: 3 }],
    loungePasses: [{ airportName: "LHR", terminal: "T5", dateOfUsage: "2026-12-20", note: "internal lounge note" }],
    airportParkings: [{ airportName: "LHR", parkingType: "Meet", parkingDate: "2026-12-20" }],
    cruises: [{ cruiseLine: "X", ship: "Y", cabinType: "Z", cruiseName: "N", cruiseDate: "2026-12-20", itinerary: [{ day: 1, description: "Sea", subDescription: "" }] }],
    passengers: [{ title: "Mr", firstName: "Bob", lastName: "Smith", type: "adult", age: 41 }],
    images: [{ id: "img-secret", image_url: "https://x/y.jpg", isPrimary: true }],
    destinationGuru: { destination: "Rovaniemi", country: "Finland", data: { mustDo: [{ name: "Husky ride" }] } },
    agent: { name: "Alex Agent", avatar: null },
    ...over,
  };
}

const FORBIDDEN_KEYS = [
  "clientName", "passengers", "firstName", "lastName", "age", "transactionId", "agentUserId", "userId",
  "clientId", "quoteId", "id", "salesPrice", "discounts", "serviceCharge", "extrasTotal", "tags", "airline", "pickUpTime",
  "dropOffTime", "pickupTime", "dropoffTime", "note_internal",
];

/** Every key at every depth, skipping the opaque destination guide content (its own free-form data). */
function allKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      if (key !== "destinationGuru") allKeys(child, out);
    }
  }
  return out;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue("q1");
  vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState());
  vi.mocked(quotePublicRepository.findRecordById).mockResolvedValue(dirtyRecord() as never);
  vi.mocked(quotePublicRepository.hasRecentLinkViewNotification).mockResolvedValue(false);
});

describe("quotePublicService.getPublicQuote: state matrix", () => {
  it("an active quote opens", async () => {
    const data = await quotePublicService.getPublicQuote(TOKEN);
    expect(data.title).toBe("Lapland");
    expect(data.expired).toBe(false);
    expect(data.expiredOn).toBeNull();
  });

  it("an expired quote still opens, flagged with the date it was held until", async () => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ dateExpiry: new Date("2020-01-02T00:00:00Z") }));
    const data = await quotePublicService.getPublicQuote(TOKEN);
    expect(data.expired).toBe(true);
    expect(data.expiredOn).toBe("2020-01-02T00:00:00.000Z");
    expect(data.agency).toEqual({ name: "Tinas Travel", phone: "0191 594 7999" });
  });

  it("a future expiry is not flagged", async () => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ dateExpiry: new Date(Date.now() + 86_400_000) }));
    expect((await quotePublicService.getPublicQuote(TOKEN)).expired).toBe(false);
  });

  it("an accepted quote (visible by the portal's rule) opens", async () => {
    // "accepted" is not a blocking status: the repository's visibility rule only excludes lost / archived.
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ visible: true }));
    await expect(quotePublicService.getPublicQuote(TOKEN)).resolves.toMatchObject({ title: "Lapland" });
  });

  it("a booked deal answers 410 BOOKED with the agency and nothing about the quote", async () => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ isBooked: true }));
    const err = await quotePublicService.getPublicQuote(TOKEN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QuoteBlockedError);
    expect((err as QuoteBlockedError).statusCode).toBe(410);
    expect((err as QuoteBlockedError).body).toEqual({
      error: "This holiday has been booked.",
      code: "BOOKED",
      agency: { name: "Tinas Travel", phone: "0191 594 7999" },
    });
    expect(quotePublicRepository.findRecordById).not.toHaveBeenCalled();
  });

  it.each([
    ["lost, archived, inactive, deal deactivated or a test deal (the portal rule says not visible)", { visible: false }],
    ["client soft-deleted", { clientDeleted: true }],
    ["not visible AND booked: never says booked", { visible: false, isBooked: true }],
  ])("%s answers 410 UNAVAILABLE", async (_label, over) => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState(over));
    const err = await quotePublicService.getPublicQuote(TOKEN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QuoteBlockedError);
    expect((err as QuoteBlockedError).body).toEqual({
      error: "This quote is no longer available.",
      code: "UNAVAILABLE",
      agency: { name: "Tinas Travel", phone: "0191 594 7999" },
    });
    expect(Object.keys((err as QuoteBlockedError).body).sort()).toEqual(["agency", "code", "error"]);
    expect(quotePublicRepository.findRecordById).not.toHaveBeenCalled();
  });

  it("a quote whose access row is missing is unavailable, with no agency", async () => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(null);
    await expect(quotePublicService.getPublicQuote(TOKEN)).rejects.toMatchObject({ statusCode: 410, body: { code: "UNAVAILABLE", agency: { name: null, phone: null } } });
  });

  it("an unknown token is a 404, the same for a malformed one (no lookup at all)", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue(null);
    await expect(quotePublicService.getPublicQuote("NOPE99")).rejects.toMatchObject({ statusCode: 404, message: "Quote not found" });
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockClear();
    await expect(quotePublicService.getPublicQuote("%27;--")).rejects.toMatchObject({ statusCode: 404, message: "Quote not found" });
    expect(quotePublicRepository.findQuoteIdByToken).not.toHaveBeenCalled();
  });

  it("a token matching more than one quote resolves to nothing (the repository logs the error): 404", async () => {
    // findQuoteIdByToken returns null for a duplicated token; the service must not fall back to anything else.
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue(null);
    await expect(quotePublicService.getPublicQuote(TOKEN)).rejects.toMatchObject({ statusCode: 404 });
    expect(quotePublicRepository.findAccessState).not.toHaveBeenCalled();
  });

  it("blockFor gives the agency without a phone when none is set", () => {
    expect(blockFor(openState({ visible: false, agencySettings: {} }))).toEqual({ code: "UNAVAILABLE", agency: { name: "Tinas Travel", phone: null } });
    expect(blockFor(openState())).toBeNull();
  });
});

describe("public payload allowlist", () => {
  it("has exactly the allowed keys and none of the forbidden ones at any depth", async () => {
    const data = await quotePublicService.getPublicQuote(TOKEN);
    expect(Object.keys(data).sort()).toEqual([
      "accommodations", "adults", "agency", "agent", "airportParkings", "attractionTickets", "carHires", "children", "countryName",
      "cruises", "destinationGuru", "destinationName", "expired", "expiredOn", "flightMeals", "flights", "holidayType", "images",
      "infants", "loungePasses", "numNights", "pets", "preBookedSeats", "pricePerPerson", "resortName", "title", "totalPrice",
      "transferType", "transfers", "travelDate",
    ]);
    const keys = allKeys(data);
    for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden), forbidden).toBe(false);
    const json = JSON.stringify(data);
    for (const secret of ["Jane", "Smith", "Bob", "tx-secret", "agent-secret", "f-secret", "img-secret", "internal lounge note", "internal-tag"]) {
      expect(json.includes(secret), secret).toBe(false);
    }
  });

  it("derives the customer total and per-person figure from the stored breakdown", async () => {
    const data = await quotePublicService.getPublicQuote(TOKEN);
    expect(data.totalPrice).toBe("980.00"); // 1000 - 100 + 50 + 30 extras
    expect(data.pricePerPerson).toBe("326.67"); // 980 / (2 adults + 1 child)
  });

  it("returns 0.00 per person with no travellers", () => {
    const data = toPublicPayload(dirtyRecord({ adults: 0, children: 0 }) as never, openState());
    expect(data.pricePerPerson).toBe("0.00");
  });

  it("keeps the counts the page shows and the transfer note it displays, and drops the lounge note it does not", () => {
    const data = toPublicPayload(dirtyRecord() as never, openState());
    expect([data.adults, data.children, data.infants]).toEqual([2, 1, 0]);
    expect(data.transfers).toEqual([{ from: "Airport", to: "Hotel", note: "Meet at arrivals" }]);
    expect(data.loungePasses).toEqual([{ airportName: "LHR", terminal: "T5", dateOfUsage: "2026-12-20" }]);
  });
});

describe("staff preview", () => {
  const scope = { orgId: "o1", orgRole: "agent", orgRoles: ["agent"], userId: "u1" } as unknown as Scope;

  it("opens a booked, lost or deleted quote and says why customers would be refused, never recording a view", async () => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ isBooked: true }));
    expect((await quotePublicService.getPreviewQuote(TOKEN, scope)).previewBlock).toBe("BOOKED");
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ visible: false }));
    expect((await quotePublicService.getPreviewQuote(TOKEN, scope)).previewBlock).toBe("UNAVAILABLE");
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState({ clientDeleted: true }));
    expect((await quotePublicService.getPreviewQuote(TOKEN, scope)).previewBlock).toBe("UNAVAILABLE");
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState());
    expect((await quotePublicService.getPreviewQuote(TOKEN, scope)).previewBlock).toBeNull();
    expect(quotePublicRepository.logView).not.toHaveBeenCalled();
    expect(quotePublicRepository.notifyAgent).not.toHaveBeenCalled();
  });

  it("checks the caller may read the quote (organisation scope and role rules) and refuses otherwise", async () => {
    vi.mocked(assertQuoteReadable).mockRejectedValue(new AppError("Quote not found", 404));
    await expect(quotePublicService.getPreviewQuote(TOKEN, scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(assertQuoteReadable).toHaveBeenCalledWith("q1", scope);
    expect(quotePublicRepository.findRecordById).not.toHaveBeenCalled();
  });

  it("an unknown token is a 404 for staff too", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue(null);
    await expect(quotePublicService.getPreviewQuote("NOPE99", scope)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("carries the same allowlisted payload plus previewBlock only", async () => {
    const data = await quotePublicService.getPreviewQuote(TOKEN, scope);
    const keys = allKeys(data);
    for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden), forbidden).toBe(false);
    expect(keys.has("previewBlock")).toBe(true);
  });
});

describe("view and share on a blocked quote", () => {
  it.each([
    ["booked", { isBooked: true }],
    ["unavailable", { visible: false }],
    ["client deleted", { clientDeleted: true }],
  ])("%s: logView records nothing and notifies nobody", async (_label, over) => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState(over));
    await expect(quotePublicService.logView(TOKEN, { deviceType: "mobile" } as never)).rejects.toBeInstanceOf(QuoteBlockedError);
    expect(quotePublicRepository.logView).not.toHaveBeenCalled();
    expect(quotePublicRepository.notifyAgent).not.toHaveBeenCalled();
  });

  it.each([
    ["booked", { isBooked: true }],
    ["unavailable", { visible: false }],
  ])("%s: logShare tells nobody", async (_label, over) => {
    vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(openState(over));
    await expect(quotePublicService.logShare(TOKEN, "WhatsApp")).rejects.toBeInstanceOf(QuoteBlockedError);
    expect(quotePublicRepository.notifyAgent).not.toHaveBeenCalled();
  });

  it("an unknown token is a 404 for view and share", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue(null);
    await expect(quotePublicService.logView("NOPE99", {} as never)).rejects.toMatchObject({ statusCode: 404 });
    await expect(quotePublicService.logShare("NOPE99", "Email")).rejects.toMatchObject({ statusCode: 404 });
    expect(quotePublicRepository.logView).not.toHaveBeenCalled();
  });
});

describe("share method validation", () => {
  it("rejects a method outside the fixed list before touching anything", async () => {
    await expect(quotePublicService.logShare(TOKEN, "<script>alert(1)</script>" as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(quotePublicRepository.findQuoteIdByToken).not.toHaveBeenCalled();
    expect(quotePublicRepository.notifyAgent).not.toHaveBeenCalled();
  });

  it.each(["WhatsApp", "Facebook", "Email", "Copy Link", "Text message", "Share"] as const)("accepts %s", async (method) => {
    vi.mocked(quotePublicRepository.findNotifyInfo).mockResolvedValue({ title: null, destinationName: "Rome", clientId: "c1", clientName: null });
    await quotePublicService.logShare(TOKEN, method);
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith("q1", "Quote Shared!", `A customer shared their Rome quote via ${method}`, undefined, "quote_shared");
  });
});

describe("agent notification throttle", () => {
  const info = () => vi.mocked(quotePublicRepository.findNotifyInfo).mockResolvedValue({ title: "Lapland", destinationName: null, clientId: "c1", clientName: "Jane Smith" });

  beforeEach(() => {
    vi.mocked(quotePublicRepository.logView).mockResolvedValue({ id: "v1" } as never);
  });

  it("rings the agent once, then stays quiet while a bell from the last hour exists, yet still records every view", async () => {
    info();
    await quotePublicService.logView(TOKEN, { deviceType: "mobile" } as never);
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledTimes(1);
    expect(quotePublicRepository.hasRecentLinkViewNotification).toHaveBeenCalledWith("q1", "/clients/c1?holiday=quote:q1", 60);

    vi.mocked(quotePublicRepository.hasRecentLinkViewNotification).mockResolvedValue(true);
    await quotePublicService.logView(TOKEN, { deviceType: "mobile" } as never);
    await quotePublicService.logView(TOKEN, { deviceType: "mobile" } as never);
    expect(quotePublicRepository.logView).toHaveBeenCalledTimes(3);
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledTimes(1);
  });
});
