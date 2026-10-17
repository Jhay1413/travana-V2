import { describe, it, expect } from "vitest";
import { updateSocialSettingsValidator } from "./social-settings.validator";

const parse = (body: unknown) => updateSocialSettingsValidator.safeParse({ body });

describe("updateSocialSettingsValidator", () => {
  it("accepts a full valid body", () => {
    expect(
      parse({ defaultViewLink: false, defaultPriceBadge: true, timeShortcuts: ["09:00", "18:30"], timezone: "Europe/London" }).success,
    ).toBe(true);
  });

  it("rejects unknown keys such as orgId", () => {
    expect(parse({ orgId: "other" }).success).toBe(false);
    expect(parse({ createdAt: "x" }).success).toBe(false);
  });

  it("accepts an empty body (all fields optional)", () => {
    expect(parse({}).success).toBe(true);
  });

  it("rejects a bad time string", () => {
    expect(parse({ timeShortcuts: ["25:00"] }).success).toBe(false);
    expect(parse({ timeShortcuts: ["9:00"] }).success).toBe(false);
    expect(parse({ timeShortcuts: ["09:60"] }).success).toBe(false);
  });

  it("rejects an empty shortcut list", () => {
    expect(parse({ timeShortcuts: [] }).success).toBe(false);
  });

  it("rejects more than 8 shortcuts", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `0${i}:00`);
    expect(parse({ timeShortcuts: nine }).success).toBe(false);
    expect(parse({ timeShortcuts: nine.slice(0, 8) }).success).toBe(true);
  });

  it("rejects an empty timezone", () => {
    expect(parse({ timezone: "" }).success).toBe(false);
  });
});
