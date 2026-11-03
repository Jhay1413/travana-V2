import { describe, expect, it } from "vitest";
import type { EnrichedQuote } from "@/features/quote/types";
import { cardPriceLabel, deleteCopy, getCardFields, postPlatforms, whenLabel } from "./card-fields";

function quote(overrides: Record<string, unknown>): EnrichedQuote {
  return { num_of_nights: 7, ...overrides } as unknown as EnrichedQuote;
}

describe("getCardFields", () => {
  it("returns hotel fields by default", () => {
    const labels = getCardFields(quote({ quote_type: "package" })).map((f) => f.label);
    expect(labels).toEqual(["Departing", "Nights", "Board", "Travel date"]);
  });

  it("returns cruise fields for cruise quotes", () => {
    const fields = getCardFields(quote({ cruises: [{ cruise_line: "P&O", ship: "Iona", cruise_date: null }] }));
    expect(fields.map((f) => f.label)).toEqual(["Cruise line", "Ship", "Nights", "Departure date"]);
    expect(fields[0].value).toBe("P&O");
  });

  it("returns lodge fields for lodge quotes", () => {
    const fields = getCardFields(quote({ quote_type: "hot_tub_break", park_name: "Oak Park" }));
    expect(fields.map((f) => f.label)).toEqual(["Park", "Lodge", "Nights", "Check-in"]);
    expect(fields[0].value).toBe("Oak Park");
  });
});

describe("cardPriceLabel", () => {
  it("prefers the per-person price", () => {
    expect(cardPriceLabel(quote({ price_per_person: "1379", sales_price: "2758" }))).toBe("£1,379.00pp");
  });

  it("falls back to the sales price", () => {
    expect(cardPriceLabel(quote({ price_per_person: null, sales_price: "2758" }))).toBe("£2758.00");
  });
});

describe("whenLabel", () => {
  it("formats a schedule", () => {
    expect(whenLabel(new Date(2026, 9, 21, 9, 0).toISOString())).toBe("Wed 21 Oct · 9:00 AM");
  });

  it("returns an empty string for missing values", () => {
    expect(whenLabel(null)).toBe("");
    expect(whenLabel("nope")).toBe("");
  });
});

describe("deleteCopy", () => {
  it("explains each status", () => {
    expect(deleteCopy("posted", null)).toBe("This only removes it from Travana. The live post stays up.");
    expect(deleteCopy("draft", null)).toBe("The draft is removed for good.");
    expect(deleteCopy("not_generated", null)).toBe("This removes the social quote for good.");
    expect(deleteCopy("scheduled", new Date(2026, 9, 21, 9, 0).toISOString())).toBe(
      "It is set for Wed 21 Oct at 9:00 AM and will not go out.",
    );
  });
});

describe("postPlatforms", () => {
  const channel = { provider: "onlysocials", accountId: 1, workspaceConfigured: true, apiKeyConfigured: true, label: "x" } as const;
  it("returns facebook when the channel is connected", () => {
    expect(postPlatforms({}, channel)).toEqual(["facebook"]);
  });
  it("returns nothing when not configured or unknown", () => {
    expect(postPlatforms({}, { ...channel, apiKeyConfigured: false })).toEqual([]);
    expect(postPlatforms({}, undefined)).toEqual([]);
  });
});
