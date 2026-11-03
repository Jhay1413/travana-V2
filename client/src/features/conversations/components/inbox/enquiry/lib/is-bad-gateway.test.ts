import { describe, expect, it } from "vitest";
import { isBadGateway } from "./is-bad-gateway";

describe("isBadGateway", () => {
  it("reads status off the interceptor's wrapped error", () => {
    const err = Object.assign(new Error("bad gateway"), { status: 502 });
    expect(isBadGateway(err)).toBe(true);
  });

  it("is false for other statuses and shapes", () => {
    expect(isBadGateway(Object.assign(new Error("x"), { status: 500 }))).toBe(false);
    expect(isBadGateway({ response: { status: 502 } })).toBe(false);
    expect(isBadGateway(null)).toBe(false);
    expect(isBadGateway(undefined)).toBe(false);
    expect(isBadGateway("502")).toBe(false);
  });
});
