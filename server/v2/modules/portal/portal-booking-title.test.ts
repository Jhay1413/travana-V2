import { describe, it, expect } from "vitest";
import { bookingDestination, bookingTitle } from "./portal-booking-title";
import { buildBookingDetail } from "./portal-booking-detail.mapper";
import { portalBookingsService } from "./portal-bookings.service";
import { vi } from "vitest";

vi.mock("./portal.repository", () => ({
  portalRepository: { findClientBookings: vi.fn(), findImagesForQuotes: vi.fn(), findImagesForBookings: vi.fn(), findDealImagesForBookings: vi.fn() },
}));
import { portalRepository } from "./portal.repository";

describe("bookingDestination / bookingTitle", () => {
  it("place: both halves, either half, or TBC", () => {
    expect(bookingDestination("Rome", "Italy")).toBe("Rome, Italy");
    expect(bookingDestination(null, "Italy")).toBe("Italy");
    expect(bookingDestination("Rome", null)).toBe("Rome");
    expect(bookingDestination(null, null)).toBe("TBC");
  });
  it("title: its own, else '<place> Getaway'", () => {
    expect(bookingTitle("Hotel Roma", "Rome, Italy")).toBe("Hotel Roma");
    expect(bookingTitle("", "Rome, Italy")).toBe("Rome, Italy Getaway");
    expect(bookingTitle(null, "TBC")).toBe("TBC Getaway");
  });
});

describe("the list and the detail agree on a booking with no title", () => {
  const header = {
    bookingId: "b1", quoteId: null, title: null, haysRef: "H", supplierRef: "S", salesPrice: "100", discounts: "0", serviceCharge: "0", extrasTotal: 0,
    adult: 2, child: 0, infant: 0, travelDate: "2027-01-01", numNights: 7, operatorName: null, boardName: null, destinationName: "Rome",
    countryName: "Italy", resortName: null, agentFirstName: null, agentLastName: null, agentAvatar: null,
  };
  it("shows the same title", async () => {
    vi.mocked(portalRepository.findClientBookings).mockResolvedValue([{ ...header, haysRef: "H", accommodationName: null }] as never);
    vi.mocked(portalRepository.findImagesForQuotes).mockResolvedValue([]);
    vi.mocked(portalRepository.findImagesForBookings).mockResolvedValue([]);
    vi.mocked(portalRepository.findDealImagesForBookings).mockResolvedValue([]);
    const [listed] = await portalBookingsService.listBookings("c1", new Date("2026-11-24T12:00:00Z"));
    const detail = buildBookingDetail(
      { header, flights: [], accommodations: [], transfers: [], carHires: [], tickets: [], lounges: [], parkings: [], cruises: [], upsells: [], images: [] },
      new Date("2026-11-24T12:00:00Z"),
    );
    expect(listed.title).toBe("Rome, Italy Getaway");
    expect(detail.title).toBe(listed.title);
  });
});
