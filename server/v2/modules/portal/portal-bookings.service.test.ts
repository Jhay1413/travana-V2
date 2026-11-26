import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal.repository", () => ({
  portalRepository: {
    findClientBookings: vi.fn(),
    findImagesForQuotes: vi.fn(),
    findImagesForBookings: vi.fn(),
    findDealImagesForBookings: vi.fn(),
  },
}));

import { portalBookingsService } from "./portal-bookings.service";
import { portalRepository } from "./portal.repository";

const repo = vi.mocked(portalRepository);

const row = {
  bookingId: "b1", quoteId: "q1", lodgeId: null, title: "Rome trip", haysRef: "HAY-123", supplierRef: null,
  salesPrice: "1000.00", discounts: "0", serviceCharge: "0", extrasTotal: 0, adult: 2, child: 0,
  travelDate: "2026-12-01", numNights: 7, accommodationName: "Hotel Roma", destinationName: "Rome", countryName: "Italy",
};

beforeEach(() => {
  vi.clearAllMocks();
  repo.findImagesForQuotes.mockResolvedValue([]);
  repo.findImagesForBookings.mockResolvedValue([]);
  repo.findDealImagesForBookings.mockResolvedValue([]);
});

describe("listBookings", () => {
  it("asks the repository for this client's bookings only (LOST filtering lives in its SQL, see portal.repository.test)", async () => {
    repo.findClientBookings.mockResolvedValue([]);
    expect(await portalBookingsService.listBookings("c1")).toEqual([]);
    expect(repo.findClientBookings).toHaveBeenCalledWith("c1");
  });

  it("maps a booking to the portal contract", async () => {
    repo.findClientBookings.mockResolvedValue([row]);
    const [b] = await portalBookingsService.listBookings("c1");
    expect(b).toMatchObject({
      id: "b1", title: "Rome trip", destination: "Rome, Italy", hotel: "Hotel Roma", travel_date: "2026-12-01",
      return_date: "2026-12-08", booking_reference: "HAY-123", documents_url: "#", image_url: "",
    });
    expect(typeof b.price).toBe("number");
  });

  it("gives the nights it has, and invents none: 0 or missing nights mean no end date and no nights", async () => {
    repo.findClientBookings.mockResolvedValue([row, { ...row, bookingId: "b2", numNights: 0 }, { ...row, bookingId: "b3", numNights: null }]);
    const [a, zero, none] = await portalBookingsService.listBookings("c1");
    expect(a).toMatchObject({ nights: 7, return_date: "2026-12-08" });
    expect(zero).toMatchObject({ nights: null, return_date: null });
    expect(none).toMatchObject({ nights: null, return_date: null });
  });

  it("a later primary booking image replaces an earlier non-primary one (primary wins within a source)", async () => {
    repo.findClientBookings.mockResolvedValue([{ ...row, quoteId: null }]);
    repo.findImagesForBookings.mockResolvedValue([
      { bookingId: "b1", url: "first-nonprimary.jpg", isPrimary: false },
      { bookingId: "b1", url: "later-primary.jpg", isPrimary: true },
    ]);
    const [b] = await portalBookingsService.listBookings("c1");
    expect(b.image_url).toBe("later-primary.jpg");
  });

  it("with no primary, the first image in a source is kept", async () => {
    repo.findClientBookings.mockResolvedValue([{ ...row, quoteId: null }]);
    repo.findImagesForBookings.mockResolvedValue([
      { bookingId: "b1", url: "one.jpg", isPrimary: false },
      { bookingId: "b1", url: "two.jpg", isPrimary: null },
    ]);
    expect((await portalBookingsService.listBookings("c1"))[0].image_url).toBe("one.jpg");
  });

  it("prefers the source quote's image, then the booking's own, then legacy deal images", async () => {
    repo.findClientBookings.mockResolvedValue([row, { ...row, bookingId: "b2", quoteId: null }, { ...row, bookingId: "b3", quoteId: null }]);
    repo.findImagesForQuotes.mockResolvedValue([{ quoteId: "q1", url: "quote.jpg", isPrimary: true }]);
    repo.findImagesForBookings.mockResolvedValue([{ bookingId: "b2", url: "own.jpg", isPrimary: true }]);
    repo.findDealImagesForBookings.mockResolvedValue([
      { bookingId: "b2", url: "legacy-b2.jpg", isPrimary: true },
      { bookingId: "b3", url: "legacy-b3.jpg", isPrimary: true },
    ]);
    const out = await portalBookingsService.listBookings("c1");
    expect(out.map((b) => b.image_url)).toEqual(["quote.jpg", "own.jpg", "legacy-b3.jpg"]);
  });
});

describe("listBookings: trip status and the fields added for the new Bookings screens", () => {
  const NOW = new Date("2026-11-24T12:00:00Z");

  it("adds operator, board, party, the operator's reference and the status by UK day; the original keys are unchanged", async () => {
    repo.findClientBookings.mockResolvedValue([{ ...row, operatorName: "Sun Holidays", boardName: "All Inclusive", infant: 1, supplierRef: " OP-9 " }]);
    const [b] = await portalBookingsService.listBookings("c1", NOW);
    expect(b).toMatchObject({
      booking_reference: "HAY-123", documents_url: "#", supplier_reference: "OP-9", operator_name: "Sun Holidays", board: "All Inclusive",
      adults: 2, children: 0, infants: 1, trip_status: "upcoming", days_to_go: 7,
    });
  });

  it("leaves unknowns null rather than inventing them", async () => {
    repo.findClientBookings.mockResolvedValue([{ ...row, supplierRef: "" }]);
    const [b] = await portalBookingsService.listBookings("c1", NOW);
    expect(b).toMatchObject({ supplier_reference: null, operator_name: null, board: null, infants: 0 });
  });

  it("upcoming, in progress and past are decided by the UK calendar day, nights known or not", async () => {
    repo.findClientBookings.mockResolvedValue([
      { ...row, bookingId: "up", travelDate: "2026-12-01" },
      { ...row, bookingId: "now", travelDate: "2026-11-22", numNights: 7 },
      { ...row, bookingId: "past", travelDate: "2026-10-01", numNights: 7 },
      { ...row, bookingId: "nolength", travelDate: "2026-11-23", numNights: 0 },
    ]);
    const out = await portalBookingsService.listBookings("c1", NOW);
    expect(out.map((b) => [b.id, b.trip_status])).toEqual([["up", "upcoming"], ["now", "in_progress"], ["past", "past"], ["nolength", "past"]]);
    expect(out.find((b) => b.id === "now")?.days_to_go).toBe(-2);
  });
});
