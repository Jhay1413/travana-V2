import { describe, it, expect } from "vitest";
import { destinationGuruDataSchema } from "./destination-guru.service";
import { coordinatesSchema, idParamValidator, updateCoordinatesValidator } from "./destination-guru.validator";

const validPayload = {
  destination: "Corfu",
  country: "Greece",
  heroEmoji: "🏛️",
  tagline: "The Emerald Isle of the Ionian Sea",
  bestTimeToVisit: {
    months: "May – October",
    reason: "Warm temperatures, clear skies, and calm seas.",
    peakSeason: "July & August",
    budgetSeason: "May & October",
  },
  flightTimesFromUK: {
    directHours: "3h 15m",
    airports: ["Manchester", "London Gatwick"],
    airlines: ["easyJet", "Jet2"],
    tips: "Book early for the best fares.",
  },
  travelInfo: {
    currency: "Euro (€)",
    language: "Greek",
    timezone: "EET (UTC+2)",
    visaRequired: "Not required for UK passport holders.",
    waterSafety: "Safe to drink.",
    plugType: "Type C/F, UK adapter needed.",
    summary: "A lush Ionian island with a mix of beaches and culture.",
  },
  temperatures: [
    { month: "Jan", avgHigh: 14, avgLow: 7, rainfall: 120 },
    { month: "Feb", avgHigh: 14, avgLow: 7, rainfall: 100 },
    { month: "Mar", avgHigh: 16, avgLow: 8, rainfall: 90 },
    { month: "Apr", avgHigh: 19, avgLow: 10, rainfall: 60 },
    { month: "May", avgHigh: 24, avgLow: 14, rainfall: 30 },
    { month: "Jun", avgHigh: 28, avgLow: 18, rainfall: 10 },
    { month: "Jul", avgHigh: 31, avgLow: 21, rainfall: 5 },
    { month: "Aug", avgHigh: 31, avgLow: 21, rainfall: 5 },
    { month: "Sep", avgHigh: 27, avgLow: 18, rainfall: 20 },
    { month: "Oct", avgHigh: 22, avgLow: 14, rainfall: 80 },
    { month: "Nov", avgHigh: 18, avgLow: 11, rainfall: 110 },
    { month: "Dec", avgHigh: 15, avgLow: 8, rainfall: 130 },
  ],
  mustDo: [
    {
      rank: 1,
      name: "Old Town Corfu",
      category: "Sightseeing",
      shortDesc: "A UNESCO World Heritage site with Venetian architecture.",
      websiteUrl: "https://example.com",
      price: "Free",
      openingHours: "24 hours",
      tips: "Visit early morning to avoid crowds.",
      bestFor: "Everyone",
      duration: "2-3 hours",
      address: "Corfu Old Town",
    },
  ],
};

describe("destinationGuruDataSchema", () => {
  it("accepts a valid payload with exactly 12 months of temperatures", () => {
    const result = destinationGuruDataSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects a payload with only 11 temperature entries", () => {
    const invalid = { ...validPayload, temperatures: validPayload.temperatures.slice(0, 11) };
    const result = destinationGuruDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing a required field", () => {
    const { travelInfo: _travelInfo, ...invalid } = validPayload;
    const result = destinationGuruDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects a payload with an empty mustDo array", () => {
    const invalid = { ...validPayload, mustDo: [] };
    const result = destinationGuruDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts a payload carrying an extra coordinates field (coordinates isn't part of the content shape)", () => {
    const withCoordinates = { ...validPayload, coordinates: { lat: 39.6243, lng: 19.9217 } };
    const result = destinationGuruDataSchema.safeParse(withCoordinates);
    expect(result.success).toBe(true);
  });
});

describe("coordinatesSchema", () => {
  it("accepts a valid lat/lng pair", () => {
    const result = coordinatesSchema.safeParse({ lat: 39.6243, lng: 19.9217 });
    expect(result.success).toBe(true);
  });

  it("rejects a latitude out of range (91)", () => {
    const result = coordinatesSchema.safeParse({ lat: 91, lng: 19.9217 });
    expect(result.success).toBe(false);
  });

  it("rejects a longitude out of range (-181)", () => {
    const result = coordinatesSchema.safeParse({ lat: 39.6243, lng: -181 });
    expect(result.success).toBe(false);
  });

  it("rejects a string instead of a number", () => {
    const result = coordinatesSchema.safeParse({ lat: "39.6243", lng: 19.9217 });
    expect(result.success).toBe(false);
  });

  it("rejects (0, 0) — the null-island sentinel, not a real destination", () => {
    const result = coordinatesSchema.safeParse({ lat: 0, lng: 0 });
    expect(result.success).toBe(false);
  });
});

describe("updateCoordinatesValidator", () => {
  it("rejects a bad uuid in params.id", () => {
    const result = updateCoordinatesValidator.safeParse({
      params: { id: "not-a-uuid" },
      body: { latitude: 39.6243, longitude: 19.9217 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid uuid and coordinate pair", () => {
    const result = updateCoordinatesValidator.safeParse({
      params: { id: "9f9c1c1a-6c1e-4f3a-8f9a-9b1e6c1a2b3c" },
      body: { latitude: 39.6243, longitude: 19.9217 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects (0, 0) on the manual PATCH too, sharing the AI path's null-island rule", () => {
    const result = updateCoordinatesValidator.safeParse({
      params: { id: "9f9c1c1a-6c1e-4f3a-8f9a-9b1e6c1a2b3c" },
      body: { latitude: 0, longitude: 0 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Coordinates (0, 0) are not a valid destination location");
    }
  });

  it("rejects an out-of-range latitude", () => {
    const result = updateCoordinatesValidator.safeParse({
      params: { id: "9f9c1c1a-6c1e-4f3a-8f9a-9b1e6c1a2b3c" },
      body: { latitude: 91, longitude: 19.9217 },
    });
    expect(result.success).toBe(false);
  });
});

describe("idParamValidator", () => {
  it("rejects a non-uuid id", () => {
    const result = idParamValidator.safeParse({ params: { id: "not-a-uuid" } });
    expect(result.success).toBe(false);
  });

  it("accepts a valid uuid", () => {
    const result = idParamValidator.safeParse({ params: { id: "9f9c1c1a-6c1e-4f3a-8f9a-9b1e6c1a2b3c" } });
    expect(result.success).toBe(true);
  });
});
