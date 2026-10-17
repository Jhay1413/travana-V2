import { describe, expect, it } from "vitest";
import { isDroppableDay, todayYmd } from "./use-calendar-drop";

describe("todayYmd", () => {
  it("formats the local date with padding", () => {
    expect(todayYmd(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(todayYmd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("isDroppableDay", () => {
  const now = new Date(2026, 9, 15, 10, 0);
  it("allows today and later, blocks earlier days", () => {
    expect(isDroppableDay("2026-10-15", now)).toBe(true);
    expect(isDroppableDay("2026-10-16", now)).toBe(true);
    expect(isDroppableDay("2026-10-14", now)).toBe(false);
  });
});
