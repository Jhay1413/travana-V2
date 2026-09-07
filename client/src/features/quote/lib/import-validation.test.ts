import { describe, expect, it } from "vitest";
import type { ImportValidation } from "@/features/quote/api/use-page-capture-import";
import {
  describeImportIssue,
  fieldLabel,
  getMoneyFieldsNeedingAttention,
  withMoneyFieldsQuarantined,
} from "./import-validation";

const validation = (issues: ImportValidation["issues"]): ImportValidation => ({
  level: issues.some((i) => i.level === "error") ? "error" : issues.length ? "warn" : "ok",
  issues,
});

describe("getMoneyFieldsNeedingAttention", () => {
  it("returns nothing when there's no validation at all — an older/degraded response behaves as before", () => {
    expect(getMoneyFieldsNeedingAttention(undefined).size).toBe(0);
  });

  it("returns nothing when there are no issues", () => {
    expect(getMoneyFieldsNeedingAttention(validation([])).size).toBe(0);
  });

  it("flags a money field only when the issue is error-level", () => {
    const v = validation([
      { code: "PRICE_ZERO", level: "error", field: "sales_price", message: "m" },
    ]);
    expect(getMoneyFieldsNeedingAttention(v)).toEqual(new Set(["sales_price"]));
  });

  it("does not flag a money field on a warning — warnings still populate", () => {
    const v = validation([
      { code: "CURRENCY_UNVERIFIED", level: "warn", field: "currency", message: "m" },
    ]);
    expect(getMoneyFieldsNeedingAttention(v).size).toBe(0);
  });

  it("ignores an error on a non-money field", () => {
    const v = validation([
      { code: "DATE_OUT_OF_RANGE", level: "error", field: "travel_date", message: "m" },
    ]);
    expect(getMoneyFieldsNeedingAttention(v).size).toBe(0);
  });
});

describe("withMoneyFieldsQuarantined", () => {
  it("passes the quote through unchanged when there's no validation", () => {
    const quote = { sales_price: 1200, quote_title: "Best Deal" };
    expect(withMoneyFieldsQuarantined(quote, undefined)).toEqual(quote);
  });

  it("drops a money field that failed validation so it isn't auto-filled with a wrong number", () => {
    const quote = { sales_price: 0, price_per_person: 300, quote_title: "Best Deal" };
    const v = validation([{ code: "PRICE_ZERO", level: "error", field: "sales_price", message: "m" }]);
    const result = withMoneyFieldsQuarantined(quote, v);
    expect(result.sales_price).toBeUndefined();
    expect(result.price_per_person).toBe(300); // untouched — no error on this field
    expect(result.quote_title).toBe("Best Deal");
  });

  it("leaves money fields populated when the only issues are warnings", () => {
    const quote = { sales_price: 1200 };
    const v = validation([{ code: "CURRENCY_UNVERIFIED", level: "warn", field: "currency", message: "m" }]);
    expect(withMoneyFieldsQuarantined(quote, v)).toEqual(quote);
  });

  it("never blocks the import — non-money fields always come through even with errors elsewhere", () => {
    const quote = { sales_price: 0, quote_title: "Plaza Prague Hotel" };
    const v = validation([{ code: "PRICE_ZERO", level: "error", field: "sales_price", message: "m" }]);
    expect(withMoneyFieldsQuarantined(quote, v).quote_title).toBe("Plaza Prague Hotel");
  });
});

describe("describeImportIssue", () => {
  it("translates a known code into agent-facing copy, not the raw code", () => {
    const display = describeImportIssue({ code: "PRICE_ZERO", level: "error", field: "sales_price", message: "raw" });
    expect(display.text).not.toBe("raw");
    expect(display.text.toLowerCase()).toContain("re-capture");
  });

  it("tells the agent to re-capture with the panel/drawer open for CAPTURE_INCOMPLETE", () => {
    const display = describeImportIssue({ code: "CAPTURE_INCOMPLETE", level: "error", message: "raw" });
    expect(display.text.toLowerCase()).toContain("panel");
  });

  it("tells the agent to re-capture with the panel/drawer open for CRUISE_ITINERARY_MISSING", () => {
    const display = describeImportIssue({ code: "CRUISE_ITINERARY_MISSING", level: "warn", field: "itinerary", message: "raw" });
    expect(display.text.toLowerCase()).toContain("panel");
  });

  it("falls back to the server's own message for an unrecognised code", () => {
    const display = describeImportIssue({ code: "SOME_NEW_CODE", level: "warn", message: "server-provided text" });
    expect(display.text).toBe("server-provided text");
  });

  it("humanises a known field name", () => {
    expect(fieldLabel("sales_price")).toBe("Sales price");
  });

  it("falls back to the raw field string for an unknown field", () => {
    expect(fieldLabel("flights[0].departing_airport_name")).toBe("flights[0].departing_airport_name");
  });

  it("leaves the field label undefined when the issue carries no field", () => {
    expect(fieldLabel(undefined)).toBeUndefined();
  });
});
