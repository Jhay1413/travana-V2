import { describe, expect, it } from "vitest";
import { taskDueRange } from "./task-ranges";

const iso = (r: { start: Date; end: Date }) => [r.start.toISOString(), r.end.toISOString()];

describe("taskDueRange (Europe/London)", () => {
  it("today in BST starts at 23:00 UTC the previous day", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(iso(taskDueRange("today", now, ""))).toEqual(["2026-07-14T23:00:00.000Z", "2026-07-15T23:00:00.000Z"]);
  });

  it("today in GMT starts at midnight UTC", () => {
    const now = new Date("2026-12-10T12:00:00Z");
    expect(iso(taskDueRange("today", now, ""))).toEqual(["2026-12-10T00:00:00.000Z", "2026-12-11T00:00:00.000Z"]);
  });

  it("uses the London day, not the UTC day, just after midnight BST", () => {
    // 23:30 UTC on 14 July is 00:30 BST on 15 July.
    const now = new Date("2026-07-14T23:30:00Z");
    expect(iso(taskDueRange("today", now, ""))[0]).toBe("2026-07-14T23:00:00.000Z");
  });

  it("tomorrow is the following London day", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(iso(taskDueRange("tomorrow", now, ""))).toEqual(["2026-07-15T23:00:00.000Z", "2026-07-16T23:00:00.000Z"]);
  });

  it("this week starts on Monday and spans seven days", () => {
    // Thursday 15 Oct 2026 (BST) -> Monday 12 Oct 00:00 BST = 11 Oct 23:00 UTC.
    const now = new Date("2026-10-15T09:00:00Z");
    expect(iso(taskDueRange("this-week", now, ""))).toEqual(["2026-10-11T23:00:00.000Z", "2026-10-18T23:00:00.000Z"]);
  });

  it("this week on a Sunday still starts the preceding Monday", () => {
    const now = new Date("2026-10-18T10:00:00Z");
    expect(taskDueRange("this-week", now, "").start.toISOString()).toBe("2026-10-11T23:00:00.000Z");
  });

  it("copes with the clocks going back mid-week (25 Oct 2026)", () => {
    // Week of Mon 19 Oct (BST) ends Mon 26 Oct 00:00 GMT.
    const now = new Date("2026-10-22T09:00:00Z");
    expect(iso(taskDueRange("this-week", now, ""))).toEqual(["2026-10-18T23:00:00.000Z", "2026-10-26T00:00:00.000Z"]);
  });

  it("copes with the clocks going forward (29 Mar 2026)", () => {
    const now = new Date("2026-03-29T12:00:00Z");
    expect(iso(taskDueRange("today", now, ""))).toEqual(["2026-03-29T00:00:00.000Z", "2026-03-29T23:00:00.000Z"]);
  });

  it("select date uses the picked London day", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(iso(taskDueRange("custom", now, "2026-12-25"))).toEqual(["2026-12-25T00:00:00.000Z", "2026-12-26T00:00:00.000Z"]);
  });

  it("select date falls back to today for a malformed key", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(taskDueRange("custom", now, "garbage").start.toISOString()).toBe("2026-07-14T23:00:00.000Z");
  });

  it("all and overdue are unbounded", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    for (const f of ["all", "overdue"] as const) {
      const r = taskDueRange(f, now, "");
      expect(r.start.getTime()).toBe(0);
      expect(r.end.getUTCFullYear()).toBe(2100);
    }
  });
});
