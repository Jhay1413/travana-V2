import { describe, expect, it } from "vitest";
import { normalizeEnquiry } from "./enum-normalizers";

describe("normalizeEnquiry status", () => {
  it.each(["Converted", "converted", "CONVERTED"])("maps %s to Converted (not the NEW_LEAD fallback)", (status) => {
    expect(normalizeEnquiry({ status }).status).toBe("Converted");
  });

  it("still maps display values and falls back to NEW_LEAD for unknown ones", () => {
    expect(normalizeEnquiry({ status: "Lost" }).status).toBe("LOST");
    expect(normalizeEnquiry({ status: "nonsense" }).status).toBe("NEW_LEAD");
  });
});
