import { describe, it, expect } from "vitest";
import { portalBookingDetailValidator } from "./portal-booking-detail.validator";

const parse = (id: unknown) => portalBookingDetailValidator.safeParse({ params: { id } });

describe("portalBookingDetailValidator", () => {
  it("accepts a uuid", () => {
    expect(parse("3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f").success).toBe(true);
  });

  it("rejects anything that is not a uuid", () => {
    for (const bad of ["", "abc", "123", "3f2b8c1e-5d4a-4b7e-9c0d", "' or 1=1 --", "../quotes", undefined]) {
      expect(parse(bad).success, String(bad)).toBe(false);
    }
  });

  it("needs the param", () => {
    expect(portalBookingDetailValidator.safeParse({ params: {} }).success).toBe(false);
  });
});
