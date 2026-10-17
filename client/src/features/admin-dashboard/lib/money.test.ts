import { describe, expect, it } from "vitest";
import { gbp, gbp2, perBooking, plural } from "./money";

describe("money", () => {
  it("formats whole pounds and pence", () => {
    expect(gbp(1840)).toBe("£1,840");
    expect(gbp(1839.6)).toBe("£1,840");
    expect(gbp2(181.2)).toBe("£181.20");
  });
  it("pluralises", () => {
    expect(plural(1, "booking")).toBe("1 booking");
    expect(plural(0, "booking")).toBe("0 bookings");
  });
  it("divides safely", () => {
    expect(perBooking(300, 3)).toBe(100);
    expect(perBooking(300, 0)).toBe(0);
  });
});
