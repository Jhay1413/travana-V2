import { describe, expect, it } from "vitest";
import type { AgentProfileWeek } from "../types";
import { buildWeekView, weekRangeText, weekStarts } from "./week-model";

const week: AgentProfileWeek = {
  start: "2026-10-19",
  days: [
    { date: "2026-10-19", items: [] },
    {
      date: "2026-10-20",
      items: [
        { kind: "task", id: "t2", title: "Call back", dueAt: "2026-10-20T14:30:00.000Z", entityType: null, entityId: null, clientId: "c1", clientName: "Ann Lee", entityTitle: null },
        { kind: "departure", id: "d1", transactionId: "tx1", clientId: "c1", clientName: "Ann Lee", title: "Maldives" },
        { kind: "task", id: "t1", title: "Send quote", dueAt: "2026-10-20T08:00:00.000Z", entityType: null, entityId: null, clientId: null, clientName: null, entityTitle: null },
      ],
    },
    { date: "2026-10-21", items: [] },
    { date: "2026-10-22", items: [] },
    { date: "2026-10-23", items: [] },
    { date: "2026-10-24", items: [] },
    { date: "2026-10-25", items: [] },
  ],
};

describe("weekStarts", () => {
  it("gives this Monday and next Monday for any day of the week", () => {
    expect(weekStarts("2026-10-19")).toEqual({ this: "2026-10-19", next: "2026-10-26" });
    expect(weekStarts("2026-10-25")).toEqual({ this: "2026-10-19", next: "2026-10-26" });
    expect(weekStarts("2026-10-22")).toEqual({ this: "2026-10-19", next: "2026-10-26" });
  });

  it("crosses New Year and the clock change", () => {
    expect(weekStarts("2027-01-01")).toEqual({ this: "2026-12-28", next: "2027-01-04" });
    expect(weekStarts("2026-10-28").this).toBe("2026-10-26");
  });
});

describe("weekRangeText", () => {
  it("reads in one month or two", () => {
    expect(weekRangeText("2026-10-19")).toBe("Monday 19 to Sunday 25 October");
    expect(weekRangeText("2026-10-26")).toBe("Monday 26 October to Sunday 1 November");
  });
});

describe("buildWeekView", () => {
  it("lays out seven Monday-to-Sunday days and marks today", () => {
    const v = buildWeekView(week, "2026-10-19", "2026-10-20");
    expect(v.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(v.days.map((d) => d.dayNumber)).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(v.days.filter((d) => d.isToday).map((d) => d.date)).toEqual(["2026-10-20"]);
  });

  it("counts by kind and orders a day's items by time", () => {
    const v = buildWeekView(week, "2026-10-19", "2026-10-20");
    expect(v.total).toBe(3);
    expect(v.summary).toBe("3 things planned");
    expect(v.chips.map((c) => c.text)).toEqual(["1 departure", "2 tasks"]);
    const tue = v.days[1].items;
    expect(tue.map((i) => i.id)).toEqual(["departure-d1", "task-t1", "task-t2"]);
    expect(tue[0]).toMatchObject({ label: "Departure", text: "Ann Lee · Maldives", time: null });
    // 08:00 UTC and 14:30 UTC are 09:00 and 15:30 in London (BST).
    expect(tue[1]).toMatchObject({ text: "Send quote", time: "09:00" });
    expect(tue[2]).toMatchObject({ text: "Call back · Ann Lee", time: "15:30" });
  });

  it("says Nothing planned for an empty or not-yet-loaded week", () => {
    const empty = buildWeekView(undefined, "2026-10-26", "2026-10-20");
    expect(empty.total).toBe(0);
    expect(empty.summary).toBe("Nothing planned.");
    expect(empty.chips).toEqual([]);
    expect(empty.days).toHaveLength(7);
    expect(empty.days.some((d) => d.isToday)).toBe(false);
  });

  it("treats a task due at London midnight as date-only", () => {
    const w: AgentProfileWeek = { start: "2026-10-19", days: [{ date: "2026-10-19", items: [{ kind: "task", id: "t", title: "Chase", dueAt: "2026-10-18T23:00:00.000Z", entityType: null, entityId: null, clientId: null, clientName: null, entityTitle: null }] }] };
    expect(buildWeekView(w, "2026-10-19", "2026-10-19").days[0].items[0].time).toBeNull();
  });
});
