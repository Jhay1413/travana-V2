import { describe, expect, it } from "vitest";
import { buildCountsLine, isValidDateRange, buildGridQueryArgs, DEFAULT_GRID_FILTERS, matchesStatusFilter, parseGridFilters, serverSocialStatus, statusChipCount, serialiseGridFilters, whenToQuery } from "./grid-filters";

describe("parseGridFilters", () => {
  it("returns defaults for an empty search", () => {
    expect(parseGridFilters("")).toEqual({ status: "all", when: "all", from: "", to: "", tag: "any", q: "" });
  });

  it("reads valid params and ignores unknown ones", () => {
    expect(parseGridFilters("?status=scheduled&when=week&tag=portal&q=%20spain%20")).toEqual({
      status: "scheduled",
      when: "week",
      from: "",
      to: "",
      tag: "portal",
      q: "spain",
    });
    expect(parseGridFilters("?status=bogus&tag=nope").status).toBe("all");
  });

  it("keeps 'when' regardless of status", () => {
    expect(parseGridFilters("?status=draft&when=today").when).toBe("today");
  });
});

describe("serialiseGridFilters", () => {
  it("omits defaults", () => {
    expect(serialiseGridFilters({ status: "all", when: "all", from: "", to: "", tag: "any", q: "" })).toBe("");
  });

  it("round-trips non-default filters", () => {
    const filters = { status: "scheduled", when: "month", from: "", to: "", tag: "featured", q: "rome" } as const;
    expect(parseGridFilters(serialiseGridFilters(filters))).toEqual(filters);
  });

  it("writes 'when' regardless of status", () => {
    expect(serialiseGridFilters({ status: "draft", when: "today", from: "", to: "", tag: "any", q: "" })).toBe("status=draft&when=today");
  });
});

describe("whenToQuery", () => {
  const now = new Date(2026, 9, 15, 14, 30);

  it("has no range for all", () => {
    expect(whenToQuery("all", now)).toEqual({ scheduleFilter: "none", rangeStart: "", rangeEnd: "" });
  });

  it("maps today to the today filter and a one-day range", () => {
    const q = whenToQuery("today", now);
    expect(q.scheduleFilter).toBe("today");
    expect(q.rangeStart).toBe(new Date(2026, 9, 15, 0, 0, 0, 0).toISOString());
    expect(q.rangeEnd).toBe(new Date(2026, 9, 15, 23, 59, 59, 999).toISOString());
  });

  it("maps week to today through six days later", () => {
    expect(whenToQuery("week", now).rangeEnd).toBe(new Date(2026, 9, 21, 23, 59, 59, 999).toISOString());
  });

  it("maps month to the end of the current month", () => {
    expect(whenToQuery("month", now).rangeEnd).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).toISOString());
  });
});

describe("buildCountsLine", () => {
  it("builds the header line", () => {
    expect(buildCountsLine({ total: 24, not_generated: 5, draft: 4, scheduled: 12, posted: 3 })).toBe(
      "24 posts · 12 scheduled · 4 drafts · 3 posted",
    );
  });

  it("singularises and handles missing counts", () => {
    expect(buildCountsLine({ total: 1, not_generated: 0, draft: 1, scheduled: 0, posted: 0 })).toBe(
      "1 post · 0 scheduled · 1 draft · 0 posted",
    );
    expect(buildCountsLine(undefined)).toBe("");
  });
});

describe("buildGridQueryArgs", () => {
  const now = new Date(2026, 9, 15, 10, 0, 0);

  it("sends scheduledOnly with a range for each when value on the scheduled status", () => {
    for (const when of ["today", "week", "month"] as const) {
      const args = buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, status: "scheduled", when }, [], 12, now);
      const q = whenToQuery(when, now);
      expect(args[1]).toBe(true);
      expect(args[2]).toBe(q.scheduleFilter);
      expect(args[4]).toBe(q.rangeStart);
      expect(args[5]).toBe(q.rangeEnd);
      expect(args[11]).toBe("scheduled");
    }
  });

  it("sends no range for when=all", () => {
    const args = buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, status: "scheduled" }, [], 12, now);
    expect(args[1]).toBe(true);
    expect(args[4]).toBe("");
    expect(args[5]).toBe("");
  });

  it("sends scheduledOnly for 'All' status when a when value is set", () => {
    const all = buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, when: "today" }, [], 12, now);
    expect(all[1]).toBe(true);
    expect(all[2]).toBe("today");
    expect(all[4]).toBe(whenToQuery("today", now).rangeStart);
    expect(all[11]).toBeUndefined();
  });

  it("does not set scheduledOnly for other statuses without a when value", () => {
    const args = buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, status: "draft" }, ["a"], 12, now);
    expect(args[1]).toBe(false);
    expect(args[4]).toBe("");
    expect(args[9]).toEqual(["a"]);
    expect(args[11]).toBe("draft");
    expect(buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, status: "posted" }, [], 12, now)[11]).toBe("posted");
    expect(buildGridQueryArgs(DEFAULT_GRID_FILTERS, [], 12, now)[11]).toBeUndefined();
  });

  it("passes the portal tag as showOnPortal and the search", () => {
    const args = buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, tag: "portal", q: "spain" }, [], 12, now);
    expect(args[3]).toBe("spain");
    expect(args[7]).toBe(true);
  });
});

describe("drafts and not-generated are separate chips", () => {
  const counts = { total: 24, not_generated: 5, draft: 4, scheduled: 12, posted: 3 };

  it("counts each chip on its own", () => {
    expect(statusChipCount("draft", counts)).toBe(4);
    expect(statusChipCount("not_generated", counts)).toBe(5);
    expect(statusChipCount("all", counts)).toBe(24);
    expect(statusChipCount("scheduled", counts)).toBe(12);
    expect(statusChipCount("posted", counts)).toBe(3);
  });

  it("matches draft and not_generated separately", () => {
    expect(matchesStatusFilter("draft", "draft")).toBe(true);
    expect(matchesStatusFilter("not_generated", "draft")).toBe(false);
    expect(matchesStatusFilter("draft", "not_generated")).toBe(false);
    expect(matchesStatusFilter("not_generated", "not_generated")).toBe(true);
    expect(matchesStatusFilter("posted", "posted")).toBe(true);
    expect(matchesStatusFilter("not_generated", "all")).toBe(true);
  });

  it("sends every chip except all to the server as-is", () => {
    expect(serverSocialStatus("all")).toBeUndefined();
    expect(serverSocialStatus("draft")).toBe("draft");
    expect(serverSocialStatus("not_generated")).toBe("not_generated");
    expect(serverSocialStatus("scheduled")).toBe("scheduled");
  });

  it("keeps ?status=not_generated as its own chip", () => {
    expect(parseGridFilters("?status=not_generated").status).toBe("not_generated");
    expect(parseGridFilters("?status=draft").status).toBe("draft");
  });
});
