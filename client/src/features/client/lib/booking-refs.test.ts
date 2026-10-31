import { describe, expect, it } from "vitest";
import { validateRefs } from "./booking-refs";

const MESSAGE = "Enter the HAYS Ref as HAY- followed by 7 or 8 numbers, e.g. HAY-1234567.";

describe("validateRefs", () => {
  it("trims and normalises the HAYS Ref and trims the supplier ref", () => {
    expect(validateRefs({ haysRef: "  hay1234567 ", supplierRef: " TUI 78451236  " })).toEqual({
      ok: true,
      value: { haysRef: "HAY-1234567", supplierRef: "TUI 78451236" },
    });
  });
  it("accepts 8 digits and rejects 6 or 9", () => {
    expect(validateRefs({ haysRef: "HAY-12345678", supplierRef: "x" }).ok).toBe(true);
    expect(validateRefs({ haysRef: "HAY-123456", supplierRef: "x" })).toEqual({ ok: false, errors: { haysRef: MESSAGE } });
    expect(validateRefs({ haysRef: "HAY-123456789", supplierRef: "x" }).ok).toBe(false);
  });
  it("leaves the supplier ref as free text", () => {
    expect(validateRefs({ haysRef: "HAY-1234567", supplierRef: "a-1/b" }).ok).toBe(true);
  });
  it("rejects a non-HAY value", () => {
    expect(validateRefs({ haysRef: "abc", supplierRef: "x" })).toEqual({ ok: false, errors: { haysRef: MESSAGE } });
  });
  it("rejects whitespace-only values", () => {
    const result = validateRefs({ haysRef: "   ", supplierRef: "TUI 1" });
    expect(result).toEqual({ ok: false, errors: { haysRef: "Enter the HAYS reference." } });
  });
  it("reports both when both are missing", () => {
    const result = validateRefs({ haysRef: "", supplierRef: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["haysRef", "supplierRef"]);
  });
  it("keeps an unchanged legacy HAYS Ref when an original is given", () => {
    expect(validateRefs({ haysRef: "HAY105391 ", supplierRef: "S" }, "HAY105391")).toEqual({
      ok: true,
      value: { haysRef: "HAY105391", supplierRef: "S" },
    });
  });
  it("enforces the format when the HAYS Ref changed from the original", () => {
    expect(validateRefs({ haysRef: "HAY105392", supplierRef: "S" }, "HAY105391").ok).toBe(false);
    expect(validateRefs({ haysRef: "hay1234567", supplierRef: "S" }, "HAY105391")).toMatchObject({
      ok: true,
      value: { haysRef: "HAY-1234567" },
    });
  });
});
