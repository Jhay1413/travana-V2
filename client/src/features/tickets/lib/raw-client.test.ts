import { describe, expect, it } from "vitest";
import { cleanContact, memberSince } from "./raw-client";

describe("raw client helpers", () => {
  it("formats member since as month and year", () => {
    expect(memberSince("2024-03-15T10:00:00Z")).toBe("Mar 2024");
    expect(memberSince(null)).toBeNull();
    expect(memberSince("garbage")).toBeNull();
  });
  it("drops the NULL placeholder from contact details", () => {
    expect(cleanContact("NULL")).toBeNull();
    expect(cleanContact("null")).toBeNull();
    expect(cleanContact("  ")).toBeNull();
    expect(cleanContact(undefined)).toBeNull();
    expect(cleanContact(" 07700 900123 ")).toBe("07700 900123");
  });
});
