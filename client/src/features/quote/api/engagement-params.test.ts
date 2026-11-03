import { describe, expect, it } from "vitest";
import { buildEngagementParams, engagementKey } from "./engagement-params";

describe("buildEngagementParams", () => {
  it("sends only the limit when no scope is given", () => {
    expect(buildEngagementParams(10)).toEqual({ limit: 10 });
  });

  it("sends mine=true and the period for the dashboard", () => {
    expect(buildEngagementParams(10, { mine: true, period: "week" })).toEqual({
      limit: 10,
      mine: "true",
      period: "week",
    });
  });

  it("omits mine when false", () => {
    expect(buildEngagementParams(5, { mine: false, period: "all" })).toEqual({ limit: 5, period: "all" });
  });
});

describe("engagementKey", () => {
  it("differs per period so each tab has its own query", () => {
    const periods = ["today", "yesterday", "week", "all"] as const;
    const keys = periods.map((period) => JSON.stringify(engagementKey(10, { mine: true, period })));
    expect(new Set(keys).size).toBe(4);
  });

  it("differs between scoped and unscoped calls", () => {
    expect(engagementKey(10)).not.toEqual(engagementKey(10, { mine: true }));
  });
});
