import { describe, it, expect } from "vitest";
import {
  biggestDealsValidator,
  monthlyValidator,
  performanceValidator,
  userIdValidator,
  weekValidator,
} from "./agent-profile.validator";

const params = { userId: "u1" };

describe("userIdValidator", () => {
  it("trims and accepts an id, rejects empty and over-long ids", () => {
    expect(userIdValidator.parse({ params: { userId: "  u1 " } }).params.userId).toBe("u1");
    expect(userIdValidator.safeParse({ params: { userId: "   " } }).success).toBe(false);
    expect(userIdValidator.safeParse({ params: { userId: "x".repeat(129) } }).success).toBe(false);
  });
});

describe("performanceValidator", () => {
  const ok = (from: string, to: string) => performanceValidator.safeParse({ params, query: { from, to } });

  it("accepts a half-open London window", () => {
    expect(ok("2026-10-01", "2026-10-20").success).toBe(true);
  });

  it("rejects from >= to, non-dates, impossible dates and spans over 400 days", () => {
    expect(ok("2026-10-20", "2026-10-20").success).toBe(false);
    expect(ok("2026-10-21", "2026-10-20").success).toBe(false);
    expect(ok("2026-10-01", "tomorrow").success).toBe(false);
    expect(ok("2026-02-30", "2026-03-05").success).toBe(false);
    expect(ok("2025-01-01", "2026-03-01").success).toBe(false);
  });

  it("allows exactly 400 days", () => {
    expect(ok("2025-01-01", "2026-02-05").success).toBe(true);
  });
});

describe("weekValidator", () => {
  const ok = (start: string) => weekValidator.safeParse({ params, query: { start } });

  it("only accepts a Monday", () => {
    expect(ok("2026-10-19").success).toBe(true); // Monday
    expect(ok("2026-10-20").success).toBe(false);
    expect(ok("2026-10-18").success).toBe(false); // Sunday
    expect(ok("nope").success).toBe(false);
  });
});

describe("monthlyValidator", () => {
  const ok = (query: Record<string, string>) => monthlyValidator.safeParse({ params, query });

  it("year is optional, four digits, 2000-2100", () => {
    expect(ok({}).success).toBe(true);
    expect(ok({ year: "2026" }).success).toBe(true);
    expect(ok({ year: "1999" }).success).toBe(false);
    expect(ok({ year: "2101" }).success).toBe(false);
    expect(ok({ year: "26" }).success).toBe(false);
  });
});

describe("biggestDealsValidator", () => {
  const ok = (query: Record<string, string>) => biggestDealsValidator.safeParse({ params, query });

  it("limit is optional and 1-20", () => {
    expect(ok({}).success).toBe(true);
    expect(ok({ limit: "5" }).success).toBe(true);
    expect(ok({ limit: "20" }).success).toBe(true);
    expect(ok({ limit: "0" }).success).toBe(false);
    expect(ok({ limit: "21" }).success).toBe(false);
    expect(ok({ limit: "abc" }).success).toBe(false);
  });
});
