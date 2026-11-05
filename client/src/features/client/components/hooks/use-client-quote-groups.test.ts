import { describe, it, expect } from "vitest";
import { quoteToRow } from "./use-client-quote-groups";
import type { QuoteWithJoins } from "../client-types";

const base = { id: "q1", transaction_id: "t1", sales_price: "1000", discounts: "100", service_charge: "50", adult: 2 } as unknown as QuoteWithJoins;

describe("quoteToRow totalCost", () => {
  it("adds extras not included in the package", () => {
    expect(quoteToRow({ ...base, extras_total: 200 } as QuoteWithJoins, "quoted").totalCost).toBe(1150);
  });

  it("is sales - discounts + service charge when there are no extras", () => {
    expect(quoteToRow(base, "quoted").totalCost).toBe(950);
  });

  it("keeps price per person holiday-only", () => {
    expect(quoteToRow({ ...base, extras_total: 200, price_per_person: "475" } as unknown as QuoteWithJoins, "quoted").pricePerPerson).toBe(475);
  });
});
