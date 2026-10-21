import { describe, it, expect } from "vitest";
import { listValidator, patchCheckValidator, summaryValidator } from "./departures.validator";

const ID = "0b9f1c52-6a1e-4c1c-9d55-1d6a3f0a2b10";

describe("listValidator", () => {
  const ok = (query: Record<string, string>) => listValidator.safeParse({ query }).success;

  it("accepts no dates, one date, or a window", () => {
    expect(ok({})).toBe(true);
    expect(ok({ from: "2026-10-20" })).toBe(true);
    expect(ok({ to: "2026-10-27" })).toBe(true);
    expect(ok({ from: "2026-10-20", to: "2026-10-27" })).toBe(true);
  });

  it("rejects bad dates, from >= to and spans over 400 days", () => {
    expect(ok({ from: "20-10-2026" })).toBe(false);
    expect(ok({ from: "2026-02-30" })).toBe(false);
    expect(ok({ from: "2026-10-20", to: "2026-10-20" })).toBe(false);
    expect(ok({ from: "2026-10-21", to: "2026-10-20" })).toBe(false);
    expect(ok({ from: "2025-01-01", to: "2026-03-01" })).toBe(false);
  });

  it("allows exactly 400 days", () => {
    expect(ok({ from: "2025-01-01", to: "2026-02-05" })).toBe(true);
  });
});

describe("summaryValidator", () => {
  const ok = (days?: string) => summaryValidator.safeParse({ query: days === undefined ? {} : { days } }).success;

  it("days is optional and 1..400", () => {
    expect(ok()).toBe(true);
    expect(ok("7")).toBe(true);
    expect(ok("400")).toBe(true);
    expect(ok("0")).toBe(false);
    expect(ok("401")).toBe(false);
    expect(ok("seven")).toBe(false);
  });
});

describe("patchCheckValidator", () => {
  const run = (params: unknown, body: unknown) => patchCheckValidator.safeParse({ params, body }).success;

  it("accepts each known key with a boolean", () => {
    for (const key of ["checkIn", "ticketsInHouse", "passportInfo", "ticketsPickUp", "completed", "fullyPaid"]) {
      expect(run({ bookingId: ID }, { key, value: true })).toBe(true);
    }
  });

  it("rejects unknown keys, non-boolean values, extra fields and bad ids", () => {
    expect(run({ bookingId: ID }, { key: "paid", value: true })).toBe(false);
    expect(run({ bookingId: ID }, { key: "checkIn", value: "yes" })).toBe(false);
    expect(run({ bookingId: ID }, { key: "checkIn" })).toBe(false);
    expect(run({ bookingId: ID }, { key: "checkIn", value: true, orgId: "x" })).toBe(false);
    expect(run({ bookingId: "nope" }, { key: "checkIn", value: true })).toBe(false);
  });
});

describe("listValidator lone bounds and strictness", () => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const ok = (query: Record<string, string>) => listValidator.safeParse({ query }).success;

  it("a lone from may reach back at most 400 days, a lone to ahead at most 400 days", () => {
    expect(ok({ from: day(-390) })).toBe(true);
    expect(ok({ from: day(-420) })).toBe(false);
    expect(ok({ to: day(390) })).toBe(true);
    expect(ok({ to: day(420) })).toBe(false);
  });

  it("rejects unknown query keys", () => {
    expect(ok({ from: day(0), org: "x" })).toBe(false);
  });
});
