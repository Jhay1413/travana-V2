import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal-booking-detail.repository", () => ({
  portalBookingDetailRepository: {
    findOwnedHeader: vi.fn(), findFlights: vi.fn(), findAccommodations: vi.fn(), findTransfers: vi.fn(), findCarHires: vi.fn(),
    findTickets: vi.fn(), findLounges: vi.fn(), findParkings: vi.fn(), findCruises: vi.fn(), findUpsells: vi.fn(),
  },
}));
vi.mock("./portal.repository", () => ({
  portalRepository: { findImagesForQuotes: vi.fn(), findImagesForBookings: vi.fn(), findDealImagesForBookings: vi.fn() },
}));

import { portalBookingDetailService } from "./portal-booking-detail.service";
import { portalBookingDetailRepository as items } from "./portal-booking-detail.repository";
import { portalRepository } from "./portal.repository";

const repo = vi.mocked(items);
const base = vi.mocked(portalRepository);

const header = {
  bookingId: "b1", quoteId: "q1", title: "Hotel Roma", haysRef: "HAY-1", supplierRef: "OP-1", salesPrice: "1000.00", discounts: "0",
  serviceCharge: "0", extrasTotal: 0, adult: 2, child: 0, infant: 0, travelDate: "2026-12-01", numNights: 7, operatorName: "Sun",
  boardName: "BB", destinationName: "Rome", countryName: "Italy", resortName: "Lazio", agentFirstName: "Sam", agentLastName: "Agent", agentAvatar: null,
};
const NOW = new Date("2026-11-24T12:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  repo.findOwnedHeader.mockResolvedValue(header);
  for (const fn of [repo.findFlights, repo.findAccommodations, repo.findTransfers, repo.findCarHires, repo.findTickets, repo.findLounges, repo.findParkings, repo.findCruises, repo.findUpsells]) {
    fn.mockResolvedValue([]);
  }
  base.findImagesForQuotes.mockResolvedValue([]);
  base.findImagesForBookings.mockResolvedValue([]);
  base.findDealImagesForBookings.mockResolvedValue([]);
});

describe("getBooking", () => {
  it("asks for the booking as THIS customer (the repository applies ownership and the live-booking rule)", async () => {
    await portalBookingDetailService.getBooking("c1", "b1", NOW);
    expect(repo.findOwnedHeader).toHaveBeenCalledWith("c1", "b1");
  });

  it("404 {Booking not found} when the booking is not theirs, is LOST, inactive or does not exist, and reads nothing else", async () => {
    repo.findOwnedHeader.mockResolvedValue(null);
    await expect(portalBookingDetailService.getBooking("c1", "b2", NOW)).rejects.toMatchObject({ statusCode: 404, message: "Booking not found" });
    expect(repo.findFlights).not.toHaveBeenCalled();
    expect(repo.findUpsells).not.toHaveBeenCalled();
    expect(base.findImagesForBookings).not.toHaveBeenCalled();
  });

  it("returns the detail with the references separate and the trip status for today (UK day)", async () => {
    const d = await portalBookingDetailService.getBooking("c1", "b1", NOW);
    expect(d).toMatchObject({ id: "b1", bookingReference: "HAY-1", supplierReference: "OP-1", tripStatus: "upcoming", daysToGo: 7, total: 1000, pricePerPerson: 500 });
  });

  it("builds the itinerary from every item reader", async () => {
    repo.findFlights.mockResolvedValue([{ flightType: "outbound", flightNumber: "BA1", departingAirport: "MAN", arrivalAirport: "FCO", departureDateTime: "2026-12-01T07:00:00Z", arrivalDateTime: null }]);
    repo.findAccommodations.mockResolvedValue([
      { name: "Hotel A", boardBasis: "BB", roomType: "Double", checkInDateTime: "2026-12-01T15:00:00Z", resortName: "R", isPrimary: true },
      { name: "Hotel B", boardBasis: "BB", roomType: "Twin", checkInDateTime: "2026-12-04T15:00:00Z", resortName: "R", isPrimary: false },
    ]);
    repo.findTransfers.mockResolvedValue([{ pickUp: "A", dropOff: "B", pickUpTime: null, dropOffTime: null }]);
    repo.findUpsells.mockResolvedValue([{ upsellType: "OTHER", description: "Gift", quantity: 2 }]);
    const d = await portalBookingDetailService.getBooking("c1", "b1", NOW);
    expect(d.flights).toHaveLength(1);
    expect(d.accommodations.map((a) => a.name)).toEqual(["Hotel A", "Hotel B"]);
    expect(d.transfers).toHaveLength(1);
    expect(d.extras).toEqual([{ type: "Extra", description: "Gift", quantity: 2 }]);
  });

  it("photos: the quote's first, then the booking's own, then legacy deal images, without repeats; primary first and the lead is flagged", async () => {
    base.findImagesForQuotes.mockResolvedValue([
      { quoteId: "q1", url: "q-a.jpg", isPrimary: false },
      { quoteId: "q1", url: "q-b.jpg", isPrimary: true },
    ]);
    base.findImagesForBookings.mockResolvedValue([{ bookingId: "b1", url: "q-a.jpg", isPrimary: false }, { bookingId: "b1", url: "own.jpg", isPrimary: false }]);
    base.findDealImagesForBookings.mockResolvedValue([{ bookingId: "b1", url: "deal.jpg", isPrimary: null }]);
    const d = await portalBookingDetailService.getBooking("c1", "b1", NOW);
    expect(d.images.map((i) => i.url)).toEqual(["q-b.jpg", "q-a.jpg", "own.jpg", "deal.jpg"]);
    expect(d.images.map((i) => i.isPrimary)).toEqual([true, false, false, false]);
    expect(base.findImagesForQuotes).toHaveBeenCalledWith(["q1"]);
  });

  it("does not look up quote photos for a booking made without a quote", async () => {
    repo.findOwnedHeader.mockResolvedValue({ ...header, quoteId: null });
    const d = await portalBookingDetailService.getBooking("c1", "b1", NOW);
    expect(base.findImagesForQuotes).not.toHaveBeenCalled();
    expect(d.images).toEqual([]);
  });
});
