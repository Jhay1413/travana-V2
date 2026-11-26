import { describe, it, expect, vi, beforeEach } from "vitest";
import { NO_DECISION, type PortalQuoteListItem } from "@shared/portal-quotes";

vi.mock("./portal.repository", () => ({ portalRepository: { findClientNameById: vi.fn(), findToldDealIds: vi.fn() } }));
vi.mock("./portal-quotes.service", () => ({ portalQuotesService: { listQuotes: vi.fn() } }));
vi.mock("./portal-bookings.service", () => ({ portalBookingsService: { listBookings: vi.fn() } }));
vi.mock("./portal-summary.repository", () => ({ portalSummaryRepository: { findBookingFacts: vi.fn() } }));
vi.mock("../wallet/wallet.service", () => ({ walletService: { getBalance: vi.fn() } }));
vi.mock("../referral/referral.repository", () => ({ referralRepository: { findByReferrerClientId: vi.fn() } }));

import { portalSummaryService } from "./portal-summary.service";
import { portalRepository } from "./portal.repository";
import { portalQuotesService } from "./portal-quotes.service";
import { portalBookingsService } from "./portal-bookings.service";
import { portalSummaryRepository } from "./portal-summary.repository";
import { walletService } from "../wallet/wallet.service";
import { referralRepository } from "../referral/referral.repository";
import type { PortalBookingDto } from "./portal.types";

const NOW = new Date("2026-11-24T10:00:00Z");

const quote = (id: string, over: Partial<PortalQuoteListItem> = {}): PortalQuoteListItem => ({
  id, token: `TOK${id}`, title: `Quote ${id}`, destination: "Rome, Italy", hotel: "", operator_name: "Secret Operator", price: 1500,
  price_per_person: 750, travel_date: "2027-01-01", return_date: "2027-01-08", nights: 7, board: null, adults: 2, children: 0,
  infants: 0, expiry_date: null, sent_at: null, image_url: "", photo_count: 0, quote_url: `/portal/quote/TOK${id}`,
  decision: { ...NO_DECISION }, ...over,
});

const booking = (id: string, start: string, end: string | null): PortalBookingDto => ({
  id, title: `Trip ${id}`, destination: "Majorca, Spain", hotel: "Hotel", price: 4000, price_per_person: 2000,
  travel_date: start, return_date: end, nights: end ? 7 : null, booking_reference: "HAYS-1", image_url: "/b.jpg", documents_url: "#", supplier_reference: null, operator_name: null, board: null, adults: 2, children: 0, infants: 0, trip_status: "upcoming", days_to_go: 0,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(portalRepository.findClientNameById).mockResolvedValue({ firstName: " Pat ", lastName: "Portal" });
  vi.mocked(portalQuotesService.listQuotes).mockResolvedValue([]);
  vi.mocked(portalBookingsService.listBookings).mockResolvedValue([]);
  vi.mocked(portalSummaryRepository.findBookingFacts).mockResolvedValue({ boardName: "All Inclusive", adult: 2, child: 1, infant: 0 });
  vi.mocked(walletService.getBalance).mockResolvedValue(0);
  vi.mocked(portalRepository.findToldDealIds).mockResolvedValue([]);
  vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([]);
});

describe("portalSummaryService.getSummary", () => {
  it("asks every source for THIS customer only", async () => {
    await portalSummaryService.getSummary("me", NOW);
    expect(portalRepository.findClientNameById).toHaveBeenCalledWith("me");
    expect(portalQuotesService.listQuotes).toHaveBeenCalledWith("me");
    expect(portalBookingsService.listBookings).toHaveBeenCalledWith("me");
    expect(walletService.getBalance).toHaveBeenCalledWith("me", { orgId: null });
    expect(referralRepository.findByReferrerClientId).toHaveBeenCalledWith("me");
  });

  it("a brand-new customer gets the name, zero counts and nothing else", async () => {
    expect(await portalSummaryService.getSummary("me", NOW)).toEqual({
      firstName: "Pat",
      counts: { quotesAwaiting: 0, upcomingBookings: 0 },
      nextBooking: null,
      priceHeld: null,
      rewards: { walletCredit: 0, rewardWaiting: false },
      toldDealIds: [],
    });
    expect(portalSummaryRepository.findBookingFacts).not.toHaveBeenCalled();
  });

  it("returns the next booking with its facts and days to go, and counts every unfinished one", async () => {
    vi.mocked(portalBookingsService.listBookings).mockResolvedValue([
      booking("old", "2026-01-01", "2026-01-08"),
      booking("far", "2027-06-14", "2027-06-21"),
      booking("near", "2026-12-24", "2026-12-31"),
    ]);
    const s = await portalSummaryService.getSummary("me", NOW);
    expect(s.counts.upcomingBookings).toBe(2);
    expect(s.nextBooking).toEqual({
      id: "near", title: "Trip near", destination: "Majorca, Spain", startDate: "2026-12-24", endDate: "2026-12-31", nights: 7,
      board: "All Inclusive", adults: 2, children: 1, infants: 0, imageUrl: "/b.jpg", daysToGo: 30,
    });
    expect(portalSummaryRepository.findBookingFacts).toHaveBeenCalledWith("me", "near");
  });

  it("counts only unanswered quotes and picks the soonest-expiring one of those", async () => {
    const day = 86_400_000;
    vi.mocked(portalQuotesService.listQuotes).mockResolvedValue([
      quote("a", { expiry_date: new Date(NOW.getTime() + 10 * day).toISOString() }),
      quote("b", { expiry_date: new Date(NOW.getTime() + 2 * day).toISOString(), price: 2100 }),
      quote("c", { expiry_date: new Date(NOW.getTime() + 1 * day).toISOString(), decision: { ...NO_DECISION, state: "interested" } }),
      quote("d", { decision: { ...NO_DECISION, state: "declined" } }),
      quote("e", { expiry_date: new Date(NOW.getTime() - day).toISOString() }),
    ]);
    const s = await portalSummaryService.getSummary("me", NOW);
    expect(s.counts.quotesAwaiting).toBe(3);
    expect(s.priceHeld).toMatchObject({ token: "TOKb", total: 2100, daysLeft: 2 });
  });

  it("reports wallet credit and a due referral reward", async () => {
    vi.mocked(walletService.getBalance).mockResolvedValue(25.5);
    vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([{ isDue: false }, { isDue: true }] as never);
    expect((await portalSummaryService.getSummary("me", NOW)).rewards).toEqual({ walletCredit: 25.5, rewardWaiting: true });
  });

  it("a negative or zero balance is no credit", async () => {
    vi.mocked(walletService.getBalance).mockResolvedValue(-3);
    expect((await portalSummaryService.getSummary("me", NOW)).rewards.walletCredit).toBe(0);
  });

  it("lists the deals this customer has already told the agent about, read for this customer only", async () => {
    vi.mocked(portalRepository.findToldDealIds).mockResolvedValue(["d1", "d2"]);
    expect((await portalSummaryService.getSummary("me", NOW)).toldDealIds).toEqual(["d1", "d2"]);
    expect(portalRepository.findToldDealIds).toHaveBeenCalledWith("me");
  });

  it("a missing or blank first name is null", async () => {
    vi.mocked(portalRepository.findClientNameById).mockResolvedValue({ firstName: "  ", lastName: "X" });
    expect((await portalSummaryService.getSummary("me", NOW)).firstName).toBeNull();
    vi.mocked(portalRepository.findClientNameById).mockResolvedValue(undefined);
    expect((await portalSummaryService.getSummary("me", NOW)).firstName).toBeNull();
  });

  it("never carries cost, commission, operator, reference or the other customer's data", async () => {
    vi.mocked(portalBookingsService.listBookings).mockResolvedValue([booking("near", "2026-12-24", "2026-12-31")]);
    vi.mocked(portalQuotesService.listQuotes).mockResolvedValue([quote("a", { expiry_date: new Date(NOW.getTime() + 86_400_000).toISOString() })]);
    const json = JSON.stringify(await portalSummaryService.getSummary("me", NOW));
    expect(json).not.toMatch(/cost|commission|operator|Secret Operator|HAYS-1|booking_reference|price_per_person|margin/i);
  });
});
