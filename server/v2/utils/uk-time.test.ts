import { describe, it, expect } from "vitest";
import { describeUkNow, formatUkLocal, nextUkTimeAt, parseUkLocalDateTime, toUkWallClock, ukLocalToUtc } from "./uk-time";

// The whole point of this util is that a UK wall-clock time survives the
// GMT/BST switch intact — a callback booked for "10pm" must be 10pm in London
// in August as well as in January.

describe("ukLocalToUtc", () => {
  it("treats summer wall-clock as BST (UTC+1)", () => {
    // 6 Aug 2026 is inside British Summer Time.
    expect(ukLocalToUtc({ year: 2026, month: 8, day: 6, hour: 22, minute: 0, second: 0 }).toISOString()).toBe(
      "2026-08-06T21:00:00.000Z",
    );
  });

  it("treats winter wall-clock as GMT (UTC+0)", () => {
    expect(ukLocalToUtc({ year: 2026, month: 1, day: 15, hour: 22, minute: 0, second: 0 }).toISOString()).toBe(
      "2026-01-15T22:00:00.000Z",
    );
  });

  it("handles the instant just after the spring-forward jump", () => {
    // Clocks go forward 01:00 GMT → 02:00 BST on 29 March 2026.
    expect(ukLocalToUtc({ year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 }).toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });

  it("resolves the DST edge cases deterministically", () => {
    // The repeated autumn hour (25 Oct 2026, 01:30 happens twice) → the second,
    // GMT occurrence.
    expect(ukLocalToUtc({ year: 2026, month: 10, day: 25, hour: 1, minute: 30, second: 0 }).toISOString()).toBe(
      "2026-10-25T01:30:00.000Z",
    );
    // The "lost" spring hour (29 Mar 2026, 01:30 never happens) → the
    // equivalent post-jump instant, which reads back as 02:30 BST.
    const gap = ukLocalToUtc({ year: 2026, month: 3, day: 29, hour: 1, minute: 30, second: 0 });
    expect(gap.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(toUkWallClock(gap).hour).toBe(2);
  });

  it("round-trips any wall-clock through toUkWallClock", () => {
    for (const w of [
      { year: 2026, month: 8, day: 6, hour: 22, minute: 0, second: 0 },
      { year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 0 },
      { year: 2027, month: 6, day: 1, hour: 0, minute: 30, second: 0 },
    ]) {
      const back = toUkWallClock(ukLocalToUtc(w));
      expect({ ...back, second: 0 }).toEqual({ ...w, second: 0 });
    }
  });
});

describe("parseUkLocalDateTime", () => {
  it("parses the model's UK-local shape as UK time, not UTC", () => {
    expect(parseUkLocalDateTime("2026-08-06 22:00")?.toISOString()).toBe("2026-08-06T21:00:00.000Z");
    expect(parseUkLocalDateTime("2026-08-06T22:00")?.toISOString()).toBe("2026-08-06T21:00:00.000Z");
    expect(parseUkLocalDateTime("2026-08-06 22:00:30")?.toISOString()).toBe("2026-08-06T21:00:30.000Z");
  });

  it("rejects a value carrying a timezone marker (it would reintroduce the offset bug)", () => {
    expect(parseUkLocalDateTime("2026-08-06T22:00:00Z")).toBeNull();
    expect(parseUkLocalDateTime("2026-08-06T22:00:00+01:00")).toBeNull();
  });

  it("rejects impossible or unparseable dates rather than rolling them over", () => {
    expect(parseUkLocalDateTime("2026-02-31 10:00")).toBeNull();
    expect(parseUkLocalDateTime("2026-13-01 10:00")).toBeNull();
    expect(parseUkLocalDateTime("2026-08-06 25:00")).toBeNull();
    expect(parseUkLocalDateTime("tomorrow at 10")).toBeNull();
    expect(parseUkLocalDateTime("")).toBeNull();
  });
});

describe("formatUkLocal / describeUkNow", () => {
  it("renders an instant in UK wall-clock terms", () => {
    // 21:00 UTC in August is 22:00 in London.
    expect(formatUkLocal(new Date("2026-08-06T21:00:00.000Z"))).toBe("2026-08-06 22:00");
    // …and in January the same UTC hour is 21:00 in London.
    expect(formatUkLocal(new Date("2026-01-15T21:00:00.000Z"))).toBe("2026-01-15 21:00");
  });

  it("describes the current UK time with its timezone abbreviation", () => {
    expect(describeUkNow(new Date("2026-08-06T21:00:00.000Z"))).toContain("BST");
    expect(describeUkNow(new Date("2026-01-15T21:00:00.000Z"))).toContain("GMT");
  });
});

describe("nextUkTimeAt", () => {
  it("uses today when the hour is still ahead", () => {
    // 08:00 UK (07:00 UTC, BST) — 10am today is still to come.
    const slot = nextUkTimeAt(10, new Date("2026-08-06T07:00:00.000Z"));
    expect(formatUkLocal(slot)).toBe("2026-08-06 10:00");
  });

  it("rolls to tomorrow once the hour has passed", () => {
    // 21:37 UK — the "anytime" case that prompted this: a task due at 10am
    // today would already be overdue, so it belongs tomorrow morning.
    const slot = nextUkTimeAt(10, new Date("2026-08-06T20:37:00.000Z"));
    expect(formatUkLocal(slot)).toBe("2026-08-07 10:00");
  });

  it("stays 10am UK across the GMT/BST divide", () => {
    expect(formatUkLocal(nextUkTimeAt(10, new Date("2026-01-15T06:00:00.000Z")))).toBe("2026-01-15 10:00");
    expect(formatUkLocal(nextUkTimeAt(10, new Date("2026-07-15T06:00:00.000Z")))).toBe("2026-07-15 10:00");
  });
});
