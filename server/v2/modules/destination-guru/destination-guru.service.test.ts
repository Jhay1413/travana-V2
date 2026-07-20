import { describe, it, expect } from "vitest";
import { destinationGuruDataSchema } from "./destination-guru.service";

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
});
