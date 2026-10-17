import { describe, it, expect } from "vitest";
import { compareWindows, compareLabels } from "./organization-overview-windows";

const iso = (r: { from: Date; to: Date }) => [r.from.toISOString(), r.to.toISOString()];

describe("compareWindows - week", () => {
  const now = new Date("2026-10-17T14:30:00Z"); // Saturday, BST

  it("prev: shifts both bounds back 7 days (like-for-like to date)", () => {
    const w = compareWindows("week", "prev", now);
    expect(iso(w.now)).toEqual(["2026-10-11T23:00:00.000Z", "2026-10-17T14:30:00.000Z"]);
    expect(iso(w.other)).toEqual(["2026-10-04T23:00:00.000Z", "2026-10-10T14:30:00.000Z"]);
  });

  it("year: shifts back 364 days so the weekday matches", () => {
    const w = compareWindows("week", "year", now);
    const fromDay = new Date(w.other.from.getTime() + 3600_000).getUTCDay();
    expect(fromDay).toBe(1); // Monday
    expect(w.other.to.getTime() - w.other.from.getTime()).toBe(w.now.to.getTime() - w.now.from.getTime());
  });

  it("spring DST: other window keeps London wall-clock hours across the clock change", () => {
    const w = compareWindows("week", "prev", new Date("2026-03-30T10:00:00Z")); // Mon 11:00 BST
    expect(w.now.from.toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(iso(w.other)).toEqual(["2026-03-23T00:00:00.000Z", "2026-03-23T11:00:00.000Z"]);
  });

  it("autumn DST: other window is Monday 00:00 BST to the same London time", () => {
    const w = compareWindows("week", "prev", new Date("2026-10-26T10:00:00Z")); // Mon 10:00 GMT
    expect(w.now.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(iso(w.other)).toEqual(["2026-10-18T23:00:00.000Z", "2026-10-19T09:00:00.000Z"]);
  });
});

describe("compareWindows - month", () => {
  it("prev: first of last month to the same day and time", () => {
    const w = compareWindows("month", "prev", new Date("2026-10-17T14:30:00Z"));
    expect(iso(w.now)).toEqual(["2026-09-30T23:00:00.000Z", "2026-10-17T14:30:00.000Z"]);
    expect(iso(w.other)).toEqual(["2026-08-31T23:00:00.000Z", "2026-09-17T14:30:00.000Z"]);
  });

  it("year: same month last year", () => {
    const w = compareWindows("month", "year", new Date("2026-10-17T14:30:00Z"));
    expect(iso(w.other)).toEqual(["2025-09-30T23:00:00.000Z", "2025-10-17T14:30:00.000Z"]);
  });

  it("January compares against December of the previous year", () => {
    const w = compareWindows("month", "prev", new Date("2026-01-10T12:00:00Z"));
    expect(iso(w.other)).toEqual(["2025-12-01T00:00:00.000Z", "2025-12-10T12:00:00.000Z"]);
  });

  it("clamps to the whole earlier month when it has no such day (31 Mar vs Feb)", () => {
    const w = compareWindows("month", "prev", new Date("2026-03-31T12:00:00Z"));
    expect(iso(w.other)).toEqual(["2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z"]);
  });

  it("month edge: London is already in April while UTC is still March", () => {
    const w = compareWindows("month", "prev", new Date("2026-03-31T23:30:00Z"));
    expect(w.now.from.toISOString()).toBe("2026-03-31T23:00:00.000Z");
    expect(iso(w.other)).toEqual(["2026-03-01T00:00:00.000Z", "2026-03-01T00:30:00.000Z"]);
  });
});

describe("compareWindows - year", () => {
  const now = new Date("2026-10-17T14:30:00Z");

  it("prev: 1 Jan last year to the same point", () => {
    const w = compareWindows("year", "prev", now);
    expect(iso(w.now)).toEqual(["2026-01-01T00:00:00.000Z", "2026-10-17T14:30:00.000Z"]);
    expect(iso(w.other)).toEqual(["2025-01-01T00:00:00.000Z", "2025-10-17T14:30:00.000Z"]);
    expect(w.against).toBe("prev");
  });

  it("year is an alias of prev and is normalised", () => {
    const w = compareWindows("year", "year", now);
    expect(w.against).toBe("prev");
    expect(iso(w.other)).toEqual(iso(compareWindows("year", "prev", now).other));
  });

  it("two_years goes back two years", () => {
    const w = compareWindows("year", "two_years", now);
    expect(iso(w.other)).toEqual(["2024-01-01T00:00:00.000Z", "2024-10-17T14:30:00.000Z"]);
    expect(w.against).toBe("two_years");
  });

  it("29 Feb clamps to 1 Mar 00:00 in a non-leap year", () => {
    const w = compareWindows("year", "prev", new Date("2028-02-29T12:00:00Z"));
    expect(iso(w.other)).toEqual(["2027-01-01T00:00:00.000Z", "2027-03-01T00:00:00.000Z"]);
  });
});

describe("compareLabels", () => {
  it("week", () => {
    expect(compareLabels("week", "prev")).toEqual({ now: "This week so far", other: "Same point last week" });
    expect(compareLabels("week", "year")).toEqual({ now: "This week so far", other: "Same week last year" });
  });
  it("month", () => {
    expect(compareLabels("month", "prev")).toEqual({ now: "This month so far", other: "Same point last month" });
    expect(compareLabels("month", "year")).toEqual({ now: "This month so far", other: "Same point last year" });
  });
  it("year, including the year alias", () => {
    expect(compareLabels("year", "prev")).toEqual({ now: "Year to date", other: "Same point last year" });
    expect(compareLabels("year", "year")).toEqual({ now: "Year to date", other: "Same point last year" });
    expect(compareLabels("year", "two_years")).toEqual({ now: "Year to date", other: "Same point two years ago" });
  });
});
