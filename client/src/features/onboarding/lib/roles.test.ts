import { describe, expect, it } from "vitest";
import { parseRole } from "./roles";

describe("parseRole (strict)", () => {
  it("accepts only the exact manager wording", () => {
    for (const t of ["Branch Manager", " shop manager ", "MANAGER", "bm"]) expect(parseRole(t)).toBe("branch_manager");
  });
  it("treats blank and agent as agent", () => {
    expect(parseRole("")).toBe("agent");
    expect(parseRole(" Agent ")).toBe("agent");
  });
  it("rejects everything else", () => {
    for (const t of ["Sales Manager", "Social Media Manager", "sm", "Travel Agent", "Homeworker", "Wizard"]) {
      expect(parseRole(t)).toBeNull();
    }
  });
});
