import { describe, expect, it } from "vitest";
import { isoToLondonParts, londonDateTimeToIso, quarterHourSlots } from "./london-datetime";

describe("londonDateTimeToIso", () => {
  it("converts summer time (UTC+1)", () => {
    expect(londonDateTimeToIso("2026-10-16", "14:30")).toBe("2026-10-16T13:30:00.000Z");
  });
  it("converts winter time (UTC+0)", () => {
    expect(londonDateTimeToIso("2026-12-10", "14:30")).toBe("2026-12-10T14:30:00.000Z");
  });
  it("is correct either side of the clocks changing", () => {
    expect(londonDateTimeToIso("2026-10-24", "23:00")).toBe("2026-10-24T22:00:00.000Z"); // BST
    expect(londonDateTimeToIso("2026-10-25", "12:00")).toBe("2026-10-25T12:00:00.000Z"); // GMT
    expect(londonDateTimeToIso("2026-03-29", "12:00")).toBe("2026-03-29T11:00:00.000Z"); // BST starts
  });
  it("keeps midnight-looking picks precise by adding one second", () => {
    expect(londonDateTimeToIso("2026-12-10", "00:00")).toBe("2026-12-10T00:00:01.000Z"); // 00:00 GMT
    expect(londonDateTimeToIso("2026-10-16", "01:00")).toBe("2026-10-16T00:00:01.000Z"); // 01:00 BST = 00:00 UTC
    expect(londonDateTimeToIso("2026-10-16", "00:00")).toBe("2026-10-15T23:00:01.000Z"); // 00:00 BST
    expect(isoToLondonParts(londonDateTimeToIso("2026-10-16", "00:00"))).toEqual({ date: "2026-10-16", time: "00:00" });
  });
  it("rejects malformed input", () => {
    expect(londonDateTimeToIso("", "10:00")).toBeNull();
    expect(londonDateTimeToIso("2026-10-16", "")).toBeNull();
    expect(londonDateTimeToIso("16/10/2026", "10:00")).toBeNull();
  });
});

describe("isoToLondonParts", () => {
  it("round-trips with londonDateTimeToIso", () => {
    for (const [date, time] of [["2026-10-16", "09:15"], ["2026-12-10", "23:45"], ["2026-03-29", "00:30"]]) {
      expect(isoToLondonParts(londonDateTimeToIso(date, time))).toEqual({ date, time });
    }
  });
  it("shows the London day for an instant just before UTC midnight", () => {
    expect(isoToLondonParts("2026-10-16T23:30:00Z")).toEqual({ date: "2026-10-17", time: "00:30" });
  });
  it("returns null for empty or invalid values", () => {
    expect(isoToLondonParts(null)).toBeNull();
    expect(isoToLondonParts("nope")).toBeNull();
  });
});

describe("quarterHourSlots", () => {
  it("has 96 slots from 00:00 to 23:45", () => {
    const slots = quarterHourSlots();
    expect(slots).toHaveLength(96);
    expect(slots[0]).toBe("00:00");
    expect(slots[95]).toBe("23:45");
  });
});
