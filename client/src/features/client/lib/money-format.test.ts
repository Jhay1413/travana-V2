import { describe, expect, it } from "vitest";
import { gbp2, minusGbp2, plusGbp2 } from "./money-format";

describe("money format", () => {
  it("always shows two decimals", () => {
    expect(gbp2(3177.46)).toBe("£3,177.46");
    expect(gbp2(0)).toBe("£0.00");
    expect(gbp2(500)).toBe("£500.00");
  });
  it("signs discounts and service charges", () => {
    expect(minusGbp2(50)).toBe("−£50.00");
    expect(minusGbp2(0)).toBe("£0.00");
    expect(plusGbp2(12.5)).toBe("+£12.50");
    expect(plusGbp2(0)).toBe("£0.00");
  });
});
