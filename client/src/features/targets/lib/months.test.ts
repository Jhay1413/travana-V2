import { describe, expect, it } from "vitest";
import { evenMonths, evenParts, parseMonths, scaleMonths, shareProportionally, spread, sum } from "./months";

const SEASON = [22000, 16000, 17000, 18000, 19000, 24000, 26000, 22000, 19000, 18000, 19000, 20000];

describe("spread", () => {
  it("always ends on the exact total", () => {
    for (const total of [1, 99, 4999, 5000, 12345, 90001, 1_000_003]) {
      expect(sum(spread(total, SEASON))).toBe(total);
    }
  });

  it("moves in £25 steps except one month, which absorbs the remainder", () => {
    const out = spread(90013, SEASON, 25);
    expect(out.filter((v) => v % 25 !== 0).length).toBeLessThanOrEqual(1);
    expect(sum(out)).toBe(90013);
  });

  it("keeps the busy and quiet pattern", () => {
    const out = spread(SEASON.reduce((s, v) => s + v, 0) * 2, SEASON);
    expect(out.indexOf(Math.max(...out))).toBe(SEASON.indexOf(Math.max(...SEASON)));
    expect(out.indexOf(Math.min(...out))).toBe(SEASON.indexOf(Math.min(...SEASON)));
  });
});

describe("spread edge cases", () => {
  it("never goes negative when rounding overshoots", () => {
    const out = spread(1003, [...Array(11).fill(1), 0], 5);
    expect(out.every((v) => v >= 0)).toBe(true);
    expect(sum(out)).toBe(1003);
    const tiny = spread(3, Array(12).fill(1), 5);
    expect(tiny.every((v) => v >= 0)).toBe(true);
    expect(sum(tiny)).toBe(3);
  });

  it("copes with a zero-weight last month and all-zero weights", () => {
    expect(sum(spread(1000, [...Array(11).fill(5), 0]))).toBe(1000);
    expect(spread(1000, Array(12).fill(0))).toEqual(evenMonths(1000));
    expect(spread(0, Array(12).fill(0))).toEqual(Array(12).fill(0));
  });

  it("holds for many totals and weight shapes", () => {
    const shapes = [SEASON, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7], [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], Array(12).fill(3)];
    for (const w of shapes) {
      for (const total of [0, 1, 2, 3, 7, 24, 26, 1003, 4999, 5001, 99999]) {
        for (const step of [5, 25]) {
          const out = spread(total, w, step);
          expect(out.every((v) => v >= 0)).toBe(true);
          expect(sum(out)).toBe(total);
        }
      }
    }
  });
});

describe("scaleMonths", () => {
  it("scales in £25 steps from £5,000 and keeps the total exact", () => {
    const out = scaleMonths(SEASON, 123456);
    expect(out).toHaveLength(12);
    expect(sum(out)).toBe(123456);
    expect(out.filter((v) => v % 25 !== 0).length).toBeLessThanOrEqual(1);
  });

  it("uses £5 steps under £5,000", () => {
    const out = scaleMonths(SEASON, 4003);
    expect(sum(out)).toBe(4003);
    expect(out.filter((v) => v % 5 !== 0).length).toBeLessThanOrEqual(1);
  });

  it("falls back to an even split when there is no pattern to keep", () => {
    expect(scaleMonths([], 1200)).toEqual(Array(12).fill(100));
    expect(scaleMonths(Array(12).fill(0), 1205)).toEqual(evenMonths(1205));
  });

  it("scales to zero", () => {
    expect(scaleMonths(SEASON, 0)).toEqual(Array(12).fill(0));
  });
});

describe("evenMonths / evenParts", () => {
  it("puts the remainder on the first months", () => {
    const out = evenMonths(1005);
    expect(out).toEqual([...Array(9).fill(84), ...Array(3).fill(83)]);
    expect(sum(out)).toBe(1005);
    expect(out[0]).toBeGreaterThanOrEqual(out[11]);
  });

  it("keeps the total exact for any size", () => {
    for (const total of [0, 1, 11, 12, 13, 999_999]) expect(sum(evenMonths(total))).toBe(total);
  });

  it("shares among n parts, remainder first", () => {
    expect(evenParts(10, 3)).toEqual([4, 3, 3]);
    expect(evenParts(10, 0)).toEqual([]);
  });
});

describe("parseMonths", () => {
  const ok = Array(12).fill("1,000");
  it("parses twelve valid boxes", () => {
    expect(parseMonths(ok)).toEqual({ ok: true, months: Array(12).fill(1000) });
  });

  it("reports each bad month by index", () => {
    const raw = [...ok];
    raw[2] = "abc";
    raw[5] = "";
    const r = parseMonths(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(["2", "5"]);
  });

  it("treats missing boxes as errors", () => {
    expect(parseMonths(["1", "2"]).ok).toBe(false);
  });
});

describe("shareProportionally", () => {
  it("keeps shares in proportion, never negative, total exact", () => {
    for (const [total, w] of [[100, [1, 1, 1]], [10, [5, 0, 5]], [7, [0, 0, 0]], [1000, [3, 2, 1]], [0, [4, 4]]] as Array<[number, number[]]>) {
      const out = shareProportionally(total, w);
      expect(out.every((v) => v >= 0)).toBe(true);
      expect(sum(out)).toBe(total);
    }
    expect(shareProportionally(1000, [3, 2, 1])).toEqual([500, 333, 167]);
    expect(shareProportionally(5, [])).toEqual([]);
  });
});
