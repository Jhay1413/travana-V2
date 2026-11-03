import { describe, it, expect } from "vitest";
import type { HomeworkerPayoutStatement } from "@shared/schema";
import {
  addDaysYmd,
  bucketWeek,
  buildPayoutRows,
  clientName,
  commissionRate,
  pickBestMonth,
  resolveStartedAt,
  toCourse,
  toMonthSeries,
} from "./agent-profile.math";

describe("commissionRate", () => {
  it("is profit over sales as a percentage, null with no sales", () => {
    expect(commissionRate(125, 1000)).toBe(12.5);
    expect(commissionRate(10, 0)).toBeNull();
  });
});

describe("clientName", () => {
  it("joins what exists", () => {
    expect(clientName("Ann", "Lee")).toBe("Ann Lee");
    expect(clientName("Ann", null)).toBe("Ann");
    expect(clientName(null, " ")).toBeNull();
  });
});

describe("toMonthSeries / pickBestMonth", () => {
  it("builds 12 YYYY-MM points, summing duplicate months and rounding", () => {
    const series = toMonthSeries(
      [
        { month: 2, amount: 100.4 },
        { month: 2, amount: 50.4 },
        { month: 13, amount: 999 },
      ],
      2026,
    );
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ month: "2026-01", profit: 0 });
    expect(series[1]).toEqual({ month: "2026-02", profit: 151 });
  });

  it("best month is the highest, earliest on a tie, null when all are zero", () => {
    const series = toMonthSeries([{ month: 3, amount: 500 }, { month: 7, amount: 500 }, { month: 9, amount: 200 }], 2026);
    expect(pickBestMonth(series)).toEqual({ month: "2026-03", profit: 500 });
    expect(pickBestMonth(toMonthSeries([], 2026))).toBeNull();
  });
});

describe("resolveStartedAt", () => {
  const created = new Date("2023-01-01T12:00:00Z");

  it("prefers the HR start date", () => {
    expect(resolveStartedAt("2024-09-02", new Date("2024-03-01T00:00:00Z"), created)).toEqual({ startedAt: "2024-09-02", source: "hr" });
  });

  it("falls back to the earliest membership, then the account, as London dates", () => {
    expect(resolveStartedAt(null, new Date("2024-03-01T12:00:00Z"), created)).toEqual({ startedAt: "2024-03-01", source: "membership" });
    expect(resolveStartedAt(null, null, created)).toEqual({ startedAt: "2023-01-01", source: "account" });
  });

  it("uses the London day: 00:30 BST on 1 July is 23:30Z on 30 June", () => {
    expect(resolveStartedAt(null, new Date("2026-06-30T23:30:00Z"), created).startedAt).toBe("2026-07-01");
    expect(resolveStartedAt(null, null, new Date("2026-06-30T23:30:00Z")).startedAt).toBe("2026-07-01");
  });
});

describe("addDaysYmd", () => {
  it("steps across month and year ends", () => {
    expect(addDaysYmd("2026-10-19", 7)).toBe("2026-10-26");
    expect(addDaysYmd("2026-12-28", 7)).toBe("2027-01-04");
  });
});

describe("bucketWeek", () => {
  const task = (id: string, dueDate: Date) =>
    ({
      id, title: `t${id}`, dueDate, entityType: "quote", entityId: "q1", clientId: "c1", clientName: "Ann Lee", entityTitle: "Spain",
    }) as never;

  it("returns seven Monday-Sunday days and files departures by travel date", () => {
    const week = bucketWeek(
      "2026-10-19",
      [{ bookingId: "b1", transactionId: "t1", clientId: "c1", clientFirstName: "Ann", clientSurname: "Lee", travelDate: "2026-10-21", title: "Spain" }],
      [],
    );
    expect(week.days.map((d) => d.date)).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
    expect(week.days[2].items).toEqual([
      { kind: "departure", id: "b1", transactionId: "t1", clientId: "c1", clientName: "Ann Lee", title: "Spain" },
    ]);
  });

  it("buckets tasks by their London day across BST and sorts by time", () => {
    // 2026-10-24 23:30 UTC is 00:30 on the 25th in London (BST until 25 Oct, 01:00 UTC).
    const late = task("late", new Date("2026-10-24T23:30:00Z"));
    const morning = task("m", new Date("2026-10-25T08:00:00Z"));
    const early = task("e", new Date("2026-10-24T09:00:00Z"));
    const week = bucketWeek("2026-10-19", [], [morning, late, early]);
    expect(week.days[5].items.map((i) => i.id)).toEqual(["e"]);
    expect(week.days[6].items.map((i) => i.id)).toEqual(["late", "m"]);
  });

  it("ignores tasks with no due date and items outside the week", () => {
    const week = bucketWeek("2026-10-19", [], [task("x", new Date("2026-11-30T09:00:00Z")), { id: "n", dueDate: null } as never]);
    expect(week.days.every((d) => d.items.length === 0)).toBe(true);
  });
});

describe("toCourse", () => {
  const base = {
    enrollmentId: "e1", courseId: "c1", title: "Sales", category: "Sales", enrolledAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: null, certificate: null,
  };

  it("computes progress from lessons and forces 100 once completed", () => {
    expect(toCourse({ ...base, status: "in_progress", lessonsTotal: 4, lessonsCompleted: 1 }).progressPct).toBe(25);
    expect(toCourse({ ...base, status: "in_progress", lessonsTotal: 0, lessonsCompleted: 0 }).progressPct).toBe(0);
    const done = toCourse({
      ...base, status: "completed", lessonsTotal: 4, lessonsCompleted: 3,
      completedAt: new Date("2026-02-01T00:00:00Z"), certificate: { issuedAt: new Date("2026-02-01T00:00:00Z"), certificateNo: "N1" },
    });
    expect(done).toMatchObject({ status: "completed", progressPct: 100, certificate: { certificateNo: "N1" } });
  });
});

describe("buildPayoutRows", () => {
  const stored = (over: Partial<HomeworkerPayoutStatement>) =>
    ({
      periodStart: "2026-09-01", periodEnd: "2026-10-01", grossProfit: "1000.00", sharePercent: "70.00",
      homeworkerShare: "700.00", status: "final", finalisedAt: new Date("2026-10-02T09:00:00Z"), ...over,
    }) as HomeworkerPayoutStatement;
  const live = {
    periodStart: "2026-10-01", periodEnd: "2026-11-01", gross: "400.00", sharePercent: "70.00", homeworkerShare: "280.00", finalised: false,
  };

  it("puts the live current month first as due, then stored rows with final = paid and draft = draft", () => {
    const rows = buildPayoutRows([stored({}), stored({ periodStart: "2026-08-01", periodEnd: "2026-09-01", status: "draft", finalisedAt: null })], live, "2026-10-01");
    expect(rows.map((r) => [r.periodStart, r.status, r.live])).toEqual([
      ["2026-10-01", "due", true],
      ["2026-09-01", "paid", false],
      ["2026-08-01", "draft", false],
    ]);
    expect(rows[1].finalisedAt).toBe("2026-10-02T09:00:00.000Z");
  });

  it("adds no live row when the current month is already stored, or when there is none", () => {
    const rows = buildPayoutRows([stored({ periodStart: "2026-10-01", periodEnd: "2026-11-01" })], live, "2026-10-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].live).toBe(false);
    expect(buildPayoutRows([], null, "2026-10-01")).toEqual([]);
  });
});
