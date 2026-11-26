import { describe, it, expect } from "vitest";
import { InMemoryPinLockout, pinDailyKey, pinLockoutKey, PIN_LOCK_MS, PIN_MAX_FAILURES, PIN_DAILY_MAX_FAILURES, PIN_DAILY_WINDOW_MS } from "./portal-pin-lockout";

function make() {
  let now = 1_000_000;
  const lock = new InMemoryPinLockout(PIN_MAX_FAILURES, PIN_LOCK_MS, () => now);
  return { lock, advance: (ms: number) => { now += ms; } };
}

describe("InMemoryPinLockout", () => {
  it("locks on the 5th failure for 15 minutes", () => {
    const { lock } = make();
    for (let i = 0; i < 4; i++) lock.recordFailure("k");
    expect(lock.lockedForMs("k")).toBe(0);
    lock.recordFailure("k");
    expect(lock.lockedForMs("k")).toBe(15 * 60 * 1000);
  });

  it("unlocks after 15 minutes with a clean slate", () => {
    const { lock, advance } = make();
    for (let i = 0; i < 5; i++) lock.recordFailure("k");
    advance(15 * 60 * 1000 + 1);
    expect(lock.lockedForMs("k")).toBe(0);
    for (let i = 0; i < 4; i++) lock.recordFailure("k");
    expect(lock.lockedForMs("k")).toBe(0);
  });

  it("reset clears the count", () => {
    const { lock } = make();
    for (let i = 0; i < 4; i++) lock.recordFailure("k");
    lock.reset("k");
    lock.recordFailure("k");
    expect(lock.lockedForMs("k")).toBe(0);
  });

  it("forgets a stale run of failures instead of accumulating forever", () => {
    const { lock, advance } = make();
    for (let i = 0; i < 4; i++) lock.recordFailure("k");
    advance(16 * 60 * 1000);
    lock.recordFailure("k");
    expect(lock.lockedForMs("k")).toBe(0);
  });

  it("keys are independent", () => {
    const { lock } = make();
    for (let i = 0; i < 5; i++) lock.recordFailure("a");
    expect(lock.lockedForMs("b")).toBe(0);
  });
});

describe("clean-up is bounded by time and by size", () => {
  it("sweeps finished locks and stale runs after the sweep interval, so entries do not pile up", () => {
    const { lock, advance } = make();
    for (let i = 0; i < 500; i++) lock.recordFailure("k" + i);
    for (let i = 0; i < 500; i++) lock.recordDailyFailure("e" + i);
    expect(lock.size).toBe(1000);
    advance(PIN_DAILY_WINDOW_MS + 61_000);
    lock.lockedForMs("anything"); // any call after the interval triggers the sweep
    expect(lock.size).toBe(0);
  });

  it("never grows past the hard cap (oldest keys evicted)", () => {
    const { lock } = make();
    for (let i = 0; i < 10_500; i++) lock.recordFailure("k" + i);
    lock.recordFailure("one-more"); // over the cap -> sweep + eviction on the next call
    expect(lock.size).toBeLessThanOrEqual(10_001);
  });
});

describe("daily budget", () => {
  it("blocks at the 20th failure and unblocks when the oldest counted failure ages out", () => {
    const { lock, advance } = make();
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES - 1; i++) {
      lock.recordDailyFailure("e");
      advance(1000);
    }
    expect(lock.dailyBlockedForMs("e")).toBe(0);
    lock.recordDailyFailure("e");
    const blocked = lock.dailyBlockedForMs("e");
    expect(blocked).toBeGreaterThan(0);
    expect(blocked).toBeLessThanOrEqual(PIN_DAILY_WINDOW_MS);
    advance(blocked);
    expect(lock.dailyBlockedForMs("e")).toBe(0);
  });

  it("reset (a successful sign-in) never clears it", () => {
    const { lock } = make();
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES; i++) lock.recordDailyFailure("e");
    lock.reset("e");
    lock.reset("e|");
    expect(lock.dailyBlockedForMs("e")).toBeGreaterThan(0);
  });

  it("is independent of the short lock and of other emails", () => {
    const { lock } = make();
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES; i++) lock.recordDailyFailure("a");
    expect(lock.dailyBlockedForMs("b")).toBe(0);
    expect(lock.lockedForMs("a")).toBe(0);
  });
});

describe("pinDailyKey", () => {
  it("is the trimmed, lower-cased, bounded email only", () => {
    expect(pinDailyKey("  Sam@Example.COM ")).toBe("sam@example.com");
    expect(pinDailyKey("a".repeat(300)).length).toBe(254);
  });
});

describe("pinLockoutKey", () => {
  it("lower-cases and trims the email, and includes the typed agency slug", () => {
    expect(pinLockoutKey("  Sam@Example.COM ", undefined)).toBe("sam@example.com|");
    expect(pinLockoutKey("sam@example.com", " Agency-A ")).toBe("sam@example.com|agency-a");
  });
});
