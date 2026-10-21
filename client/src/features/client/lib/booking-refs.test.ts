import { describe, expect, it } from "vitest";
import { validateRefs } from "./booking-refs";

describe("validateRefs", () => {
  it("trims both values", () => {
    expect(validateRefs({ haysRef: "  HAY105391 ", supplierRef: " TUI 78451236  " })).toEqual({
      ok: true,
      value: { haysRef: "HAY105391", supplierRef: "TUI 78451236" },
    });
  });
  it("accepts free text with no pattern", () => {
    expect(validateRefs({ haysRef: "abc", supplierRef: "x" }).ok).toBe(true);
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
});
