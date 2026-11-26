import { describe, expect, it } from "vitest";
import type { PublicQuoteData } from "@/features/quote/api/use-quote-public-queries";
import { agencyToBranding, buildPublicJourney, formatTotal, interestedHref, placeLine, publicDetails, publicPhotos, quoteTitle, returnDay, starLine, telHref } from "./public-quote";

const quote = (over: Partial<PublicQuoteData> = {}): PublicQuoteData => ({
  title: "Hotel Playa Azul Majorca",
  holidayType: "Package",
  travelDate: "2026-12-20T00:00:00.000Z",
  numNights: 7,
  adults: 2,
  children: 1,
  infants: 0,
  pets: 1,
  totalPrice: "2350.00",
  pricePerPerson: "783.33",
  transferType: "Private",
  flightMeals: true,
  preBookedSeats: "12A, 12B",
  destinationName: "Majorca",
  countryName: "Spain",
  resortName: "Playa",
  flights: [
    { flightType: "outbound", flightNumber: "BA1", departingAirport: "LHR", arrivalAirport: "PMI", departureDateTime: "2026-12-20T06:30:00", arrivalDateTime: "2026-12-20T10:00:00", legOrder: 1 },
    { flightType: "inbound", flightNumber: "BA2", departingAirport: "PMI", arrivalAirport: "LHR", departureDateTime: "2026-12-27T11:00:00", arrivalDateTime: "2026-12-27T12:30:00", legOrder: 1 },
  ],
  accommodations: [
    { name: "Hotel Playa Azul", boardBasis: "All Inclusive", roomType: "Double", checkInDateTime: "2026-12-20T15:00:00", starRating: "4" },
    { name: "Hotel Playa Azul", boardBasis: "All Inclusive", roomType: "Double", checkInDateTime: "2026-12-23T15:00:00", starRating: null },
  ],
  transfers: [{ from: "PMI", to: "Hotel", note: "Meet at arrivals" }],
  carHires: [{ pickupLocation: "PMI", dropoffLocation: "PMI", numDays: 3 }],
  attractionTickets: [{ type: "Aquarium", dateOfVisit: "2026-12-22", numberOfTickets: 3 }],
  loungePasses: [{ airportName: "LHR", terminal: "T5", dateOfUsage: "2026-12-20" }],
  airportParkings: [{ airportName: "LHR", parkingType: "Meet and greet", parkingDate: "2026-12-20" }],
  cruises: [{ cruiseLine: "Line", ship: "Ship", cabinType: "Balcony", cruiseName: "Med Sun", cruiseDate: "2026-12-24", itinerary: [{ day: 1, description: "Palma", subDescription: "" }] }],
  images: [
    { image_url: "https://img.example/a.jpg", isPrimary: false },
    { image_url: null, isPrimary: false },
    { image_url: "https://img.example/b.jpg", isPrimary: true },
  ],
  destinationGuru: null,
  agent: { name: "Sam Jones", avatar: null },
  agency: { name: "Sunny Travel", phone: "0161 000 0000", logoUrl: "https://cdn.example/logo.png", iconUrl: null, email: "hi@sunny.example", address: "1 High St" },
  expired: false,
  expiredOn: null,
  ...over,
});

describe("public quote helpers", () => {
  it("builds the page branding from the agency block and nothing else", () => {
    expect(agencyToBranding(quote().agency)).toEqual({
      name: "Sunny Travel",
      logoUrl: "https://cdn.example/logo.png",
      iconUrl: null,
      brandColor: null,
      phone: "0161 000 0000",
      email: "hi@sunny.example",
      address: "1 High St",
    });
  });

  it("sends 'I'm interested' to the portal sign-in with this quote as the destination", () => {
    expect(interestedHref("AbC123")).toBe("/portal/login?next=%2Fportal%2Fquote%2FAbC123");
  });

  it("makes a dialable tel link from a typed phone number", () => {
    expect(telHref("0191 594 7999")).toBe("tel:01915947999");
    expect(telHref("+44 (0)191 594")).toBe("tel:+440191594");
  });

  it("adds the nights to the travel date without a time-zone shift", () => {
    expect(returnDay("2026-12-20T00:30:00.000Z", 7)).toBe("2026-12-27");
    expect(returnDay("2026-12-28", 5)).toBe("2027-01-02");
    expect(returnDay(null, 7)).toBeNull();
    expect(returnDay("2026-12-20", 0)).toBeNull();
  });

  it("formats the total and leaves out a zero or missing one", () => {
    expect(formatTotal("2350.00")).toBe("£2,350.00");
    expect(formatTotal("0.00")).toBe("");
    expect(formatTotal("abc")).toBe("");
    expect(formatTotal(null)).toBe("");
  });

  it("turns a star rating into a line", () => {
    expect(starLine("4")).toBe("4-star hotel");
    expect(starLine("5 stars")).toBe("5-star hotel");
    expect(starLine(null)).toBe("");
    expect(starLine("0")).toBe("");
  });

  it("keeps every kind of item in the journey, with the hotel's star rating", () => {
    const kinds = buildPublicJourney(quote()).map((i) => i.kind);
    for (const kind of ["flight-out", "flight-in", "transfer", "hotel", "cruise", "car-hire", "tickets", "lounge", "parking"]) expect(kinds).toContain(kind);
    const hotels = buildPublicJourney(quote()).filter((i) => i.kind === "hotel");
    expect(hotels).toHaveLength(2);
    expect(hotels[0].detail).toContain("4-star hotel");
    expect(hotels[1].detail).not.toContain("4-star hotel");
  });

  it("lists the details, one hotel name once, leaving out blanks", () => {
    const rows = Object.fromEntries(publicDetails(quote()).map((r) => [r.label, r.value]));
    expect(rows["Hotel"]).toBe("Hotel Playa Azul");
    expect(rows["Travel dates"]).toBe("20 Dec 2026 to 27 Dec 2026");
    expect(rows["Departure airport"]).toBe("LHR");
    expect(rows["Passengers"]).toBe("2 adults, 1 child, 1 pet");
    expect(rows["In-flight meals"]).toBe("Included");
    const bare = publicDetails(quote({ transferType: "None", flightMeals: false, preBookedSeats: "", holidayType: "" }));
    expect(bare.map((r) => r.label)).not.toContain("Transfer");
    expect(bare.map((r) => r.label)).not.toContain("In-flight meals");
    expect(bare.map((r) => r.label)).not.toContain("Pre-booked seats");
  });

  it("falls back for the title and place line", () => {
    expect(quoteTitle({ title: "", destinationName: "Majorca", countryName: "Spain" })).toBe("Majorca, Spain");
    expect(quoteTitle({ title: "", destinationName: "", countryName: "" })).toBe("Your holiday");
    expect(placeLine({ resortName: "Playa", destinationName: "Majorca", countryName: "Spain" })).toBe("Playa · Majorca · Spain");
    expect(placeLine({ resortName: "Majorca", destinationName: "Majorca", countryName: "" })).toBe("Majorca");
  });

  it("drops photos with no URL and leads with the primary one", () => {
    const { photos, lead } = publicPhotos(quote().images);
    expect(photos.map((p) => p.url)).toEqual(["https://img.example/a.jpg", "https://img.example/b.jpg"]);
    expect(new Set(photos.map((p) => p.id)).size).toBe(2);
    expect(lead).toBe("https://img.example/b.jpg");
    expect(publicPhotos([]).lead).toBeUndefined();
  });
});
