import { describe, it, expect } from "vitest";
import { checkStatusTransition } from "./transaction-status-transition";

const BOTH = { hasQuote: true, hasBooking: true };
const NONE = { hasQuote: false, hasBooking: false };

describe("checkStatusTransition", () => {
  it("allows no change", () => {
    expect(checkStatusTransition("on_quote", undefined, NONE).ok).toBe(true);
    expect(checkStatusTransition("on_quote", "on_quote", NONE).ok).toBe(true);
  });
  it("allows forward moves when backed by a record", () => {
    expect(checkStatusTransition("on_enquiry", "on_quote", BOTH).ok).toBe(true);
    expect(checkStatusTransition("on_quote", "on_booking", BOTH).ok).toBe(true);
  });
  it("rejects backward moves", () => {
    expect(checkStatusTransition("on_quote", "on_enquiry", BOTH).ok).toBe(false);
    expect(checkStatusTransition("on_booking", "on_enquiry", BOTH).ok).toBe(false);
    expect(checkStatusTransition("on_booking", "on_quote", BOTH).ok).toBe(false);
  });
  it("rejects on_quote without a quote and on_booking without a booking", () => {
    expect(checkStatusTransition("on_enquiry", "on_quote", NONE).ok).toBe(false);
    expect(checkStatusTransition("on_quote", "on_booking", { hasQuote: true, hasBooking: false }).ok).toBe(false);
  });
  it("rejects unknown statuses", () => {
    expect(checkStatusTransition("on_quote", "bogus", BOTH).ok).toBe(false);
  });
});
