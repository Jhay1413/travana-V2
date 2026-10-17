import { describe, expect, it } from "vitest";
import { chipTime, localYmd, visibleRange } from "./calendar-range";

describe("visibleRange", () => {
  it("covers whole weeks for a month", () => {
    const r = visibleRange("month", "2026-10", "2026-10-12");
    expect(r.firstDay).toBe("2026-09-28");
    expect(r.lastDay).toBe("2026-11-01");
    expect(new Date(r.startUtc).getTime()).toBe(new Date("2026-09-28T00:00:00").getTime());
    expect(new Date(r.endUtc).getTime()).toBe(new Date("2026-11-01T23:59:59.999").getTime());
  });

  it("covers seven days for a week", () => {
    const r = visibleRange("week", "2026-10", "2026-10-12");
    expect(r.firstDay).toBe("2026-10-12");
    expect(r.lastDay).toBe("2026-10-18");
  });
});

describe("chip helpers", () => {
  it("formats local time lowercase", () => {
    expect(chipTime(new Date(2026, 9, 21, 9, 0).toISOString())).toBe("9:00am");
    expect(chipTime(new Date(2026, 9, 21, 0, 5).toISOString())).toBe("12:05am");
    expect(chipTime(new Date(2026, 9, 21, 15, 30).toISOString())).toBe("3:30pm");
  });

  it("returns the local day", () => {
    expect(localYmd(new Date(2026, 9, 21, 23, 30).toISOString())).toBe("2026-10-21");
  });
});
