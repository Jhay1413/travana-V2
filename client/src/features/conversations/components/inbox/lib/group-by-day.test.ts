import { describe, expect, it } from "vitest";
import { formatRowTime, groupRows } from "./group-by-day";

const now = new Date(2026, 9, 15, 12, 0); // Thursday
const iso = (d: number, h = 9, m = 0) => new Date(2026, 9, d, h, m).toISOString();

describe("groupRows", () => {
  it("groups in order and omits empties", () => {
    const rows = [iso(1), iso(15), iso(14), iso(15, 10)];
    const g = groupRows(rows, (r) => r, now);
    expect(g.map((x) => [x.key, x.label, x.rows.length])).toEqual([
      ["today", "TODAY", 2],
      ["yesterday", "YESTERDAY", 1],
      ["earlier", "EARLIER", 1],
    ]);
    expect(groupRows([iso(1)], (r) => r, now).map((x) => x.key)).toEqual(["earlier"]);
  });
});

describe("formatRowTime", () => {
  it("formats by distance", () => {
    expect(formatRowTime(iso(15, 10, 42), now)).toBe("10:42");
    expect(formatRowTime(iso(14), now)).toBe("Yesterday");
    expect(formatRowTime(iso(12), now)).toBe("Mon");
    expect(formatRowTime(iso(9), now)).toBe("Fri");
    expect(formatRowTime(iso(8), now)).toBe("8 Oct");
    expect(formatRowTime(iso(1), now)).toBe("1 Oct");
  });
});
