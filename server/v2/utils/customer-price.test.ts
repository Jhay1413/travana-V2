import { describe, it, expect } from "vitest";
import { customerPrice, pricePerPersonText } from "./customer-price";

describe("customerPrice", () => {
  it("total and per person both include the extras not in the package", () => {
    const p = customerPrice({ salesPrice: "2000", discounts: "100", serviceCharge: "50", extrasTotal: "300", adults: 2, children: 0 });
    expect(p.holidayTotal).toBe(1950);
    expect(p.total).toBe(2250);
    expect(p.pricePerPerson).toBe(1125);
  });

  it("no travellers gives 0 per person, and missing values are 0", () => {
    expect(customerPrice({ salesPrice: null, adults: 0, children: null })).toEqual({ holidayTotal: 0, total: 0, pricePerPerson: 0 });
  });
});

describe("pricePerPersonText", () => {
  it("formats (price - discounts + service charge + extras) / travellers to 2dp", () => {
    expect(pricePerPersonText({ salesPrice: "2000", discounts: "100", serviceCharge: "50", extrasTotal: "301", adults: 2, children: 1 })).toBe("750.33");
  });
  it("is 0.00 with no travellers", () => {
    expect(pricePerPersonText({ salesPrice: "2000", adults: 0, children: 0 })).toBe("0.00");
  });
});
