import { describe, expect, it } from "vitest";
import { addDays, dateTileParts, dayLabel, daysAway, formatChangeTime, formatTravelDate, isSoon, londonLongDate } from "./day-labels";

describe("day-labels", () => {
  it("formats a travel date", () => {
    expect(formatTravelDate("2026-10-17")).toBe("Sat 17 Oct");
    expect(formatTravelDate("2026-10-17T00:00:00.000Z")).toBe("Sat 17 Oct");
  });

  it("splits a date tile", () => {
    expect(dateTileParts("2026-10-19")).toEqual({ day: "Mon", num: "19" });
  });

  it("counts days between day keys across a month end", () => {
    expect(daysAway("2026-11-02", "2026-10-30")).toBe(3);
    expect(daysAway("2026-10-30", "2026-10-30")).toBe(0);
    expect(daysAway("2026-10-29", "2026-10-30")).toBe(-1);
  });

  it("labels days", () => {
    expect(dayLabel(0)).toBe("Today");
    expect(dayLabel(-2)).toBe("Today");
    expect(dayLabel(1)).toBe("Tomorrow");
    expect(dayLabel(5)).toBe("In 5 days");
  });

  it("marks soon only when not done", () => {
    expect(isSoon(3, false)).toBe(true);
    expect(isSoon(4, false)).toBe(false);
    expect(isSoon(1, true)).toBe(false);
    expect(isSoon(7, false, 7)).toBe(true);
  });

  it("adds days to a key", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
  });

  it("writes the London long date", () => {
    expect(londonLongDate(new Date("2026-10-20T12:00:00Z"))).toBe("Tuesday 20 October 2026");
  });

  it("formats the change time relative to now, in London", () => {
    const now = new Date("2026-10-20T15:00:00Z"); // 16:00 BST
    expect(formatChangeTime("2026-10-20T13:05:00Z", now)).toBe("Today, 14:05");
    expect(formatChangeTime("2026-10-19T08:12:00Z", now)).toBe("Yesterday, 09:12");
    expect(formatChangeTime("2026-10-15T15:20:00Z", now)).toBe("Thu 15 Oct, 16:20");
    expect(formatChangeTime("nonsense", now)).toBe("");
  });
});
