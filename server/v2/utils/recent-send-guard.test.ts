import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRecentSendGuard } from "./recent-send-guard";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createRecentSendGuard", () => {
  it("passes until a key is recorded, then throws 429 with the message", () => {
    const guard = createRecentSendGuard(1000);
    expect(() => guard.assert("k", "dup")).not.toThrow();
    guard.record("k");
    expect(() => guard.assert("k", "dup")).toThrow(expect.objectContaining({ message: "dup", statusCode: 429 }));
  });

  it("does not block other keys", () => {
    const guard = createRecentSendGuard(1000);
    guard.record("a");
    expect(() => guard.assert("b", "dup")).not.toThrow();
  });

  it("lets the key through again once the window passes", () => {
    const guard = createRecentSendGuard(1000);
    guard.record("k");
    vi.advanceTimersByTime(1001);
    expect(() => guard.assert("k", "dup")).not.toThrow();
  });

  it("keeps separate guards independent", () => {
    const a = createRecentSendGuard(1000);
    const b = createRecentSendGuard(1000);
    a.record("k");
    expect(() => b.assert("k", "dup")).not.toThrow();
  });
});
