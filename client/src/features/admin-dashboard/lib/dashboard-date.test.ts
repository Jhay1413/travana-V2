import { describe, expect, it } from "vitest";
import { londonDayMonth, londonLongDate, londonWeekday, londonClock, nextBriefingText, timeToMinutes } from "./dashboard-date";

describe("dashboard-date", () => {
  it("formats London dates", () => {
    expect(londonLongDate(new Date("2026-10-17T10:00:00Z"))).toBe("Saturday 17 October 2026");
    expect(londonDayMonth(new Date("2026-10-16T12:00:00Z"))).toBe("Friday 16 October");
    expect(londonWeekday(new Date("2026-10-16T12:00:00Z"))).toBe("Friday");
  });

  it("uses the London day around midnight in BST", () => {
    // 23:30 UTC on 16 Oct is 00:30 on Saturday 17 Oct in London (BST).
    expect(londonDayMonth(new Date("2026-10-16T23:30:00Z"))).toBe("Saturday 17 October");
  });

  it("shows the London clock", () => {
    expect(londonClock(new Date("2026-10-16T08:05:00Z"))).toBe("9:05am");
    expect(londonClock(new Date("2026-12-16T15:30:00Z"))).toBe("3:30pm");
  });

  it("parses times", () => {
    expect(timeToMinutes("8:00am")).toBe(480);
    expect(timeToMinutes("12:30pm")).toBe(750);
    expect(timeToMinutes("12:00am")).toBe(0);
    expect(timeToMinutes("nonsense")).toBeNull();
  });

  it("skips the weekend after a Friday afternoon", () => {
    // Friday 16 Oct 2026, 16:00 London (BST = 15:00 UTC).
    expect(nextBriefingText(new Date("2026-10-16T15:00:00Z"), "8:00am", true)).toBe(
      "Next briefing: Monday 19 October at 8:00am, in the app and by email.",
    );
  });

  it("keeps the same weekday when the time has not passed", () => {
    // Monday 19 Oct 2026, 07:00 London (BST = 06:00 UTC).
    expect(nextBriefingText(new Date("2026-10-19T06:00:00Z"), "8:00am", false)).toBe(
      "Next briefing: Monday 19 October at 8:00am, in the app.",
    );
  });

  it("moves to the next day when the time is exactly now", () => {
    // 08:00 London on Monday 19 Oct is 07:00 UTC.
    expect(nextBriefingText(new Date("2026-10-19T07:00:00Z"), "8:00am", true)).toContain("Tuesday 20 October");
  });

  it("works in winter time", () => {
    // Friday 18 Dec 2026, 09:30 GMT.
    expect(nextBriefingText(new Date("2026-12-18T09:30:00Z"), "9:00am", true)).toContain("Monday 21 December at 9:00am");
  });
});
