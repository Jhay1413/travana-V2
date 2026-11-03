import { describe, expect, it } from "vitest";
import { badgeTone } from "./badge-tone";

describe("badgeTone", () => {
  it("returns null for empty badges", () => {
    expect(badgeTone(null)).toBeNull();
    expect(badgeTone("  ")).toBeNull();
  });
  it("maps the known client types", () => {
    expect(badgeTone("Repeat Client")).toMatchObject({ icon: "star", className: expect.stringContaining("sky") });
    expect(badgeTone("New Client")).toMatchObject({ icon: "check" });
    expect(badgeTone("VIP Client")?.className).toContain("ticket-amber");
    expect(badgeTone("Family Member")?.className).toContain("stage-quoted");
    expect(badgeTone("Banned")?.className).toContain("status-failed");
    expect(badgeTone("Time Waster")?.className).toContain("status-failed");
  });
  it("falls back to a neutral tone for unknown badges", () => {
    expect(badgeTone("Other")).toMatchObject({ label: "Other", icon: null });
  });
});
