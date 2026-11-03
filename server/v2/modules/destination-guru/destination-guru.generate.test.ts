import { describe, it, expect, vi, beforeEach } from "vitest";

const { create, findByDestination, repositoryCreate, updateCoordinates, markGeocodeFailed, recordAiUsage } = vi.hoisted(() => ({
  create: vi.fn(),
  findByDestination: vi.fn(),
  repositoryCreate: vi.fn(),
  updateCoordinates: vi.fn(),
  markGeocodeFailed: vi.fn(),
  recordAiUsage: vi.fn(),
}));

vi.mock("../../utils/ai-model", () => ({
  CHAT_MODEL: "test-chat-model",
  UTILITY_MODEL: "test-utility-model",
  getOpenAI: () => ({ chat: { completions: { create } } }),
}));

vi.mock("../usage/usage.service", () => ({
  usageService: { recordAiUsage },
}));

vi.mock("./destination-guru.repository", () => ({
  destinationGuruRepository: {
    findByDestination,
    create: repositoryCreate,
    updateCoordinates,
    markGeocodeFailed,
  },
}));

import { destinationGuruService } from "./destination-guru.service";

const contentPayload = {
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
  temperatures: Array.from({ length: 12 }, (_, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
    avgHigh: 20,
    avgLow: 10,
    rainfall: 50,
  })),
  mustDo: [
    {
      rank: 1,
      name: "Old Town Corfu",
      category: "Sightseeing",
      shortDesc: "A UNESCO World Heritage site with Venetian architecture.",
    },
  ],
};

function mockGenerationResponse(coordinates: unknown) {
  create.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify({ ...contentPayload, coordinates }) } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });
}

function mockGeocodeResponse(coordinates: unknown) {
  create.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(coordinates) } }],
    usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
  });
}

describe("destinationGuruService.generate — coordinates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByDestination.mockResolvedValue(undefined);
    repositoryCreate.mockImplementation(async (data) => ({ id: "new-id", ...data }));
  });

  it("persists AI-supplied coordinates with source 'ai', and never inside the data jsonb", async () => {
    mockGenerationResponse({ lat: 39.6243, lng: 19.9217 });

    const result = await destinationGuruService.generate("Corfu", "user-1", "org-1");

    expect(repositoryCreate).toHaveBeenCalledTimes(1);
    const createArgs = repositoryCreate.mock.calls[0][0];
    expect(createArgs.latitude).toBe(39.6243);
    expect(createArgs.longitude).toBe(19.9217);
    expect(createArgs.coordinatesSource).toBe("ai");
    expect(createArgs.data).not.toHaveProperty("coordinates");
    expect(result).toMatchObject({ latitude: 39.6243, longitude: 19.9217, coordinatesSource: "ai" });
    // Only the generation call — geocode fallback should not have been used.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("falls back to geocodeDestination when the AI's own coordinates are invalid", async () => {
    mockGenerationResponse({ lat: 0, lng: 0 }); // invalid sentinel
    mockGeocodeResponse({ lat: 39.6243, lng: 19.9217 });

    const result = await destinationGuruService.generate("Corfu", "user-1", "org-1");

    expect(create).toHaveBeenCalledTimes(2);
    const createArgs = repositoryCreate.mock.calls[0][0];
    expect(createArgs.latitude).toBe(39.6243);
    expect(createArgs.longitude).toBe(19.9217);
    expect(createArgs.coordinatesSource).toBe("ai");
    expect(result).toMatchObject({ coordinatesSource: "ai" });
  });

  it("persists NULL lat/lng with coordinatesSource 'failed' when both the AI field and the geocode fallback fail", async () => {
    mockGenerationResponse({ lat: 0, lng: 0 });
    mockGeocodeResponse({ lat: 0, lng: 0 }); // fallback also invalid

    await destinationGuruService.generate("Corfu", "user-1", "org-1");

    const createArgs = repositoryCreate.mock.calls[0][0];
    expect(createArgs.latitude).toBeNull();
    expect(createArgs.longitude).toBeNull();
    expect(createArgs.coordinatesSource).toBe("failed");
  });

  it("short-circuits when a row already exists (with coordinates) and doesn't call OpenAI", async () => {
    findByDestination.mockResolvedValue({
      id: "existing-id",
      destination: "Corfu",
      country: "Greece",
      latitude: 39.6243,
      longitude: 19.9217,
      coordinatesSource: "ai",
    });

    const result = await destinationGuruService.generate("Corfu", "user-1", "org-1");

    expect(create).not.toHaveBeenCalled();
    expect(repositoryCreate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "existing-id" });
  });
});

describe("destinationGuruService.generate — existing-row coordinate self-heal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryCreate.mockImplementation(async (data) => ({ id: "new-id", ...data }));
  });

  it("heals an existing row with no coordinates and no prior attempt (coordinatesSource NULL)", async () => {
    findByDestination.mockResolvedValue({
      id: "existing-id",
      destination: "Corfu",
      country: "Greece",
      latitude: null,
      longitude: null,
      coordinatesSource: null,
    });
    mockGeocodeResponse({ lat: 39.6243, lng: 19.9217 });
    updateCoordinates.mockResolvedValue({
      id: "existing-id",
      latitude: 39.6243,
      longitude: 19.9217,
      coordinatesSource: "ai",
    });

    const result = await destinationGuruService.generate("Corfu", "user-1", "org-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(updateCoordinates).toHaveBeenCalledWith("existing-id", {
      latitude: 39.6243,
      longitude: 19.9217,
      coordinatesSource: "ai",
    });
    expect(result).toMatchObject({ coordinatesSource: "ai" });
  });

  it("marks the row 'failed' (not a re-bill loop) when the heal's geocode returns nothing, then never retries on a later matching request", async () => {
    const existingRow = {
      id: "existing-id",
      destination: "Corfu",
      country: "Greece",
      latitude: null,
      longitude: null,
      coordinatesSource: null,
    };
    findByDestination.mockResolvedValue(existingRow);
    mockGeocodeResponse({ lat: 0, lng: 0 }); // invalid — geocodeDestination resolves to null
    markGeocodeFailed.mockResolvedValue({ ...existingRow, coordinatesSource: "failed" });

    const firstResult = await destinationGuruService.generate("Corfu", "user-1", "org-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(markGeocodeFailed).toHaveBeenCalledWith("existing-id");
    expect(firstResult).toMatchObject({ coordinatesSource: "failed" });

    // Second, fuzzy-matched request against the now-'failed' row must not
    // call OpenAI again.
    findByDestination.mockResolvedValue({ ...existingRow, coordinatesSource: "failed" });
    const secondResult = await destinationGuruService.generate("Corfu Town", "user-1", "org-1");

    expect(create).toHaveBeenCalledTimes(1); // no additional OpenAI call
    expect(markGeocodeFailed).toHaveBeenCalledTimes(1);
    expect(secondResult).toMatchObject({ coordinatesSource: "failed" });
  });
});
