import { describe, it, expect } from "vitest";
import { addNights, latestDecisions, summariseImages, toIso } from "./portal-quotes.mapper";

describe("latestDecisions", () => {
  const at = (iso: string) => new Date(iso);

  it("the newest accepted / declined / reopened action wins (rows are newest first)", () => {
    const map = latestDecisions([
      { quoteId: "a", actionType: "reopened", message: null, reason: null, wantsSimilar: null, createdAt: at("2026-11-24T12:00:00Z") },
      { quoteId: "a", actionType: "declined", message: null, reason: "Wrong dates", wantsSimilar: true, createdAt: at("2026-11-24T11:00:00Z") },
      { quoteId: "b", actionType: "declined", message: "n", reason: "Too expensive", wantsSimilar: false, createdAt: at("2026-11-24T11:00:00Z") },
      { quoteId: "b", actionType: "accepted", message: null, reason: null, wantsSimilar: null, createdAt: at("2026-11-24T10:00:00Z") },
      { quoteId: "c", actionType: "accepted", message: "yes", reason: null, wantsSimilar: null, createdAt: at("2026-11-24T10:00:00Z") },
    ]);
    expect(map.get("a")?.state).toBe("none");
    expect(map.get("b")).toMatchObject({ state: "declined", reason: "Too expensive", wantsSimilar: false, note: "n" });
    expect(map.get("c")).toMatchObject({ state: "interested", note: "yes", at: "2026-11-24T10:00:00.000Z" });
    expect(map.get("d")).toBeUndefined();
  });

  it("a later interested overrides an earlier decline", () => {
    const map = latestDecisions([
      { quoteId: "a", actionType: "accepted", message: null, reason: null, wantsSimilar: null, createdAt: at("2026-11-24T12:00:00Z") },
      { quoteId: "a", actionType: "declined", message: null, reason: "Wrong dates", wantsSimilar: true, createdAt: at("2026-11-24T11:00:00Z") },
    ]);
    expect(map.get("a")?.state).toBe("interested");
  });
});

describe("summariseImages", () => {
  it("lead image is the primary one (else the first); the count is distinct photos", () => {
    const m = summariseImages([
      { quoteId: "a", url: "1.jpg", isPrimary: false },
      { quoteId: "a", url: "2.jpg", isPrimary: true },
      { quoteId: "a", url: "2.jpg", isPrimary: false },
      { quoteId: "b", url: "x.jpg", isPrimary: false },
      { quoteId: null, url: "ignored.jpg", isPrimary: true },
    ]);
    expect(m.get("a")).toEqual({ url: "2.jpg", count: 2 });
    expect(m.get("b")).toEqual({ url: "x.jpg", count: 1 });
    expect(m.size).toBe(2);
  });
});

describe("dates", () => {
  it("addNights counts calendar days and crosses a clock change", () => {
    expect(addNights("2026-12-01", 7)).toBe("2026-12-08");
    expect(addNights("2026-03-25", 7)).toBe("2026-04-01");
    expect(addNights("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("toIso handles dates, strings and nothing", () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso("not a date")).toBeNull();
    expect(toIso(new Date("2026-12-24T00:00:00Z"))).toBe("2026-12-24T00:00:00.000Z");
  });
});
