import { describe, expect, it } from "vitest";
import { isValidHaysRef, normaliseHaysRef } from "./booking-refs";

describe("normaliseHaysRef", () => {
  it("accepts 7 and 8 digits", () => {
    expect(normaliseHaysRef("HAY-1234567")).toBe("HAY-1234567");
    expect(normaliseHaysRef("HAY-12345678")).toBe("HAY-12345678");
  });
  it("rejects 6 and 9 digits", () => {
    expect(normaliseHaysRef("HAY-123456")).toBeNull();
    expect(normaliseHaysRef("HAY-123456789")).toBeNull();
  });
  it("accepts lower case, a missing hyphen and surrounding spaces", () => {
    expect(normaliseHaysRef("hay-1234567")).toBe("HAY-1234567");
    expect(normaliseHaysRef("hay1234567")).toBe("HAY-1234567");
    expect(normaliseHaysRef("HAY 1234567")).toBe("HAY-1234567");
    expect(normaliseHaysRef("  hay12345678  ")).toBe("HAY-12345678");
  });
  it("rejects other shapes", () => {
    expect(normaliseHaysRef("")).toBeNull();
    expect(normaliseHaysRef("HAYS-1234567")).toBeNull();
    expect(normaliseHaysRef("HAY-12345AB")).toBeNull();
    expect(normaliseHaysRef("1234567")).toBeNull();
  });
  it("isValidHaysRef mirrors it", () => {
    expect(isValidHaysRef("hay1234567")).toBe(true);
    expect(isValidHaysRef("HAY105391")).toBe(false);
  });
});
