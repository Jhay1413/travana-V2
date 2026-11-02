import { describe, it, expect } from "vitest";
import {
  addDaysToIsoDate,
  isDepartureSweepEnabled,
  planDepartureSweep,
  startOfUkDay,
  ukDateString,
  DEPARTURE_SWEEP_CRON,
  DEPARTURE_SWEEP_TIMEZONE,
} from "./sms.schedule";

describe("isDepartureSweepEnabled", () => {
  it("is off by default", () => {
    expect(isDepartureSweepEnabled({})).toBe(false);
  });
  it("is on only for the exact string true", () => {
    expect(isDepartureSweepEnabled({ SMS_DEPARTURE_SWEEP_ENABLED: "true" })).toBe(true);
    for (const v of ["TRUE", "True", "1", "yes", "false", "", " true"]) {
      expect(isDepartureSweepEnabled({ SMS_DEPARTURE_SWEEP_ENABLED: v })).toBe(false);
    }
  });
});

describe("schedule constants", () => {
  it("runs at 09:00 UK time", () => {
    expect(DEPARTURE_SWEEP_CRON).toBe("0 9 * * *");
    expect(DEPARTURE_SWEEP_TIMEZONE).toBe("Europe/London");
  });
});

describe("ukDateString", () => {
  it("uses the UK calendar day, not the UTC one", () => {
    // 23:30 UTC on 30 Jun is already 1 Jul in British Summer Time.
    expect(ukDateString(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    // In winter UK time equals UTC.
    expect(ukDateString(new Date("2026-12-30T23:30:00Z"))).toBe("2026-12-30");
  });
});

describe("addDaysToIsoDate", () => {
  it("crosses month, year and clock-change boundaries by calendar days", () => {
    expect(addDaysToIsoDate("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysToIsoDate("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDaysToIsoDate("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDaysToIsoDate("2026-11-01", 0)).toBe("2026-11-01");
  });
});

describe("startOfUkDay", () => {
  it("is 23:00 UTC the evening before in summer", () => {
    expect(startOfUkDay(new Date("2026-07-01T08:00:00Z")).toISOString()).toBe("2026-06-30T23:00:00.000Z");
  });
  it("is 00:00 UTC in winter", () => {
    expect(startOfUkDay(new Date("2026-12-01T09:00:00Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
  it("handles the day the clocks go back (25 Oct 2026, a 25 hour day)", () => {
    expect(startOfUkDay(new Date("2026-10-25T12:00:00Z")).toISOString()).toBe("2026-10-24T23:00:00.000Z");
  });
  it("handles the day the clocks go forward (29 Mar 2026)", () => {
    expect(startOfUkDay(new Date("2026-03-29T12:00:00Z")).toISOString()).toBe("2026-03-29T00:00:00.000Z");
  });
});

describe("planDepartureSweep", () => {
  const now = new Date("2026-11-02T09:00:00Z");

  it("maps each days-before value to exactly one travel date from UK today", () => {
    const plan = planDepartureSweep(now, [14, 7]);
    expect(plan.today).toBe("2026-11-02");
    expect(plan.targets).toEqual([
      { daysBefore: 7, travelDate: "2026-11-09" },
      { daysBefore: 14, travelDate: "2026-11-16" },
    ]);
    expect(plan.dedupeSince.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("dedupes repeated values and drops null, negative and fractional ones", () => {
    const plan = planDepartureSweep(now, [14, 14, null, undefined, -3, 2.5]);
    expect(plan.targets.map((t) => t.daysBefore)).toEqual([14]);
  });

  it("never targets a departure that has already passed (first run or after downtime)", () => {
    const plan = planDepartureSweep(now, [0, 1, 7, 14, 30, -1, -30]);
    expect(plan.targets.length).toBe(5);
    for (const t of plan.targets) expect(t.travelDate >= plan.today).toBe(true);
  });

  it("includes departures today for a zero value", () => {
    expect(planDepartureSweep(now, [0]).targets).toEqual([{ daysBefore: 0, travelDate: "2026-11-02" }]);
  });

  it("returns no targets when nothing is configured", () => {
    expect(planDepartureSweep(now, []).targets).toEqual([]);
  });

  it("anchors on the UK day when the UTC date differs", () => {
    const plan = planDepartureSweep(new Date("2026-06-30T23:30:00Z"), [1]);
    expect(plan.today).toBe("2026-07-01");
    expect(plan.targets[0]!.travelDate).toBe("2026-07-02");
  });
});
