import { describe, expect, it } from "vitest";
import { shouldShowLunaBanner } from "./luna-banner";

const base = { conversationType: "sales", clientLinked: true, enquiryCreated: false, dismissed: false };

describe("shouldShowLunaBanner", () => {
  it("shows for a linked sales chat", () => expect(shouldShowLunaBanner(base)).toBe(true));
  it("hides for admin or unknown type", () => {
    expect(shouldShowLunaBanner({ ...base, conversationType: "admin" })).toBe(false);
    expect(shouldShowLunaBanner({ ...base, conversationType: null })).toBe(false);
  });
  it("hides when unlinked, created or dismissed", () => {
    expect(shouldShowLunaBanner({ ...base, clientLinked: false })).toBe(false);
    expect(shouldShowLunaBanner({ ...base, enquiryCreated: true })).toBe(false);
    expect(shouldShowLunaBanner({ ...base, dismissed: true })).toBe(false);
  });
});
