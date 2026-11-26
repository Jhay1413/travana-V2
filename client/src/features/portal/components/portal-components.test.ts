import { describe, it, expect } from "vitest";
import { sanitisePin } from "./PinField";
import { stripPrefix } from "./PortalFooter";
import { portalButtonClass } from "./brand";

describe("sanitisePin", () => {
  it("keeps digits only and at most four", () => {
    expect(sanitisePin("12a3-4567")).toBe("1234");
    expect(sanitisePin("abc")).toBe("");
  });
});

describe("stripPrefix", () => {
  it("does not repeat a prefix the agency typed", () => {
    expect(stripPrefix("ATOL 1234", "ATOL")).toBe("1234");
    expect(stripPrefix("atol1234", "ATOL")).toBe("1234");
    expect(stripPrefix("1234", "ATOL")).toBe("1234");
    expect(stripPrefix("ATOL", "ATOL")).toBe("ATOL");
  });
});

describe("portalButtonClass", () => {
  it("is square and keeps a 44px+ target", () => {
    const cls = portalButtonClass("amber");
    expect(cls).toContain("rounded-none");
    expect(cls).toContain("min-h-[52px]");
  });
});

describe("sanitisePin on paste", () => {
  it("strips non-digits before cutting to four", () => {
    expect(sanitisePin("12ab34567")).toBe("1234");
    expect(sanitisePin(" 4 8 2 1 9")).toBe("4821");
  });
});
