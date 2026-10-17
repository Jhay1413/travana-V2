import { describe, expect, it } from "vitest";
import { operatorInitials } from "./operator-initials";

describe("operatorInitials", () => {
  it("uses the first letters of the first two words", () => {
    expect(operatorInitials("Tui Holidays")).toBe("TH");
    expect(operatorInitials("jet2 holidays ltd")).toBe("JH");
  });

  it("uses two letters of a single word", () => {
    expect(operatorInitials("Tui")).toBe("TU");
  });

  it("falls back to a question mark", () => {
    expect(operatorInitials(null)).toBe("?");
    expect(operatorInitials("   ")).toBe("?");
  });
});
