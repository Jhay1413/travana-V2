import { describe, expect, it } from "vitest";
import { canConvertEnquiry } from "./enquiry-convert";

describe("canConvertEnquiry", () => {
  it("allows open enquiries", () => {
    for (const status of ["New", "Open", "Quoted", undefined, null]) {
      expect(canConvertEnquiry({ status })).toBe(true);
    }
  });
  it("hides it once converted or lost", () => {
    expect(canConvertEnquiry({ status: "Converted" })).toBe(false);
    expect(canConvertEnquiry({ status: "LOST" })).toBe(false);
  });
});
