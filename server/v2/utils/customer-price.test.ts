import { describe, it, expect } from "vitest";
import { customerPrice } from "./customer-price";

describe("customerPrice", () => {
  it("total includes extras, per person is the holiday total only", () => {
    const p = customerPrice({ salesPrice: "2000", discounts: "100", serviceCharge: "50", extrasTotal: "300", adults: 2, children: 0 });
    expect(p.holidayTotal).toBe(1950);
    expect(p.total).toBe(2250);
    expect(p.pricePerPerson).toBe(975);
  });

  it("no travellers gives 0 per person, and missing values are 0", () => {
    expect(customerPrice({ salesPrice: null, adults: 0, children: null })).toEqual({ holidayTotal: 0, total: 0, pricePerPerson: 0 });
  });
});
