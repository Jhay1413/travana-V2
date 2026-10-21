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
      "24 posts · 12 scheduled · 9 drafts · 3 posted",
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
    expect(args[11]).toBeUndefined();
    expect(buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, status: "posted" }, [], 12, now)[11]).toBe("posted");
    expect(buildGridQueryArgs(DEFAULT_GRID_FILTERS, [], 12, now)[11]).toBeUndefined();
  });

  it("passes the portal tag as showOnPortal and the search", () => {
    const args = buildGridQueryArgs({ ...DEFAULT_GRID_FILTERS, tag: "portal", q: "spain" }, [], 12, now);
    expect(args[3]).toBe("spain");
    expect(args[7]).toBe(true);
  });
});

describe("drafts chip folds in not-generated posts", () => {
  const counts = { total: 24, not_generated: 5, draft: 4, scheduled: 12, posted: 3 };

  it("adds not_generated to the Drafts count only", () => {
    expect(statusChipCount("draft", counts)).toBe(9);
    expect(statusChipCount("all", counts)).toBe(24);
    expect(statusChipCount("scheduled", counts)).toBe(12);
    expect(statusChipCount("posted", counts)).toBe(3);
  });

  it("matches both draft and not_generated under Drafts", () => {
    expect(matchesStatusFilter("draft", "draft")).toBe(true);
    expect(matchesStatusFilter("not_generated", "draft")).toBe(true);
    expect(matchesStatusFilter("scheduled", "draft")).toBe(false);
    expect(matchesStatusFilter("posted", "posted")).toBe(true);
    expect(matchesStatusFilter("draft", "posted")).toBe(false);
    expect(matchesStatusFilter("not_generated", "all")).toBe(true);
  });

  it("loads Drafts unfiltered from the server and sends the other statuses as they are", () => {
    expect(serverSocialStatus("draft")).toBeUndefined();
    expect(serverSocialStatus("all")).toBeUndefined();
    expect(serverSocialStatus("scheduled")).toBe("scheduled");
  });

  it("sends old not_generated links to Drafts", () => {
    expect(parseGridFilters("?status=not_generated").status).toBe("draft");
  });
});

describe("custom date range", () => {
  const now = new Date(2026, 9, 15, 10, 0, 0);
  const custom = { ...DEFAULT_GRID_FILTERS, when: "custom", from: "2026-11-01", to: "2026-11-30" } as const;

  it("round-trips through the URL", () => {
    expect(serialiseGridFilters(custom)).toBe("when=custom&from=2026-11-01&to=2026-11-30");
    expect(parseGridFilters(serialiseGridFilters(custom))).toEqual(custom);
  });

  it("drops malformed dates and ignores from/to unless custom", () => {
    expect(parseGridFilters("?when=custom&from=nope&to=2026-02-31")).toMatchObject({ from: "", to: "" });
    expect(serialiseGridFilters({ ...custom, when: "week" })).toBe("when=week");
  });

  it("validates from <= to", () => {
    expect(isValidDateRange("2026-11-01", "2026-11-01")).toBe(true);
    expect(isValidDateRange("2026-11-02", "2026-11-01")).toBe(false);
    expect(isValidDateRange("", "2026-11-01")).toBe(false);
  });

  it("sends scheduledOnly with local day bounds", () => {
    const args = buildGridQueryArgs(custom, [], 12, now);
    expect(args[1]).toBe(true);
    expect(args[2]).toBe("none");
    expect(args[4]).toBe(new Date(2026, 10, 1, 0, 0, 0, 0).toISOString());
    expect(args[5]).toBe(new Date(2026, 10, 30, 23, 59, 59, 999).toISOString());
  });

  it("ignores an invalid or incomplete range", () => {
    for (const bad of [{ from: "2026-11-30", to: "2026-11-01" }, { from: "2026-11-01", to: "" }]) {
      const args = buildGridQueryArgs({ ...custom, ...bad }, [], 12, now);
      expect(args[1]).toBe(false);
      expect(args[4]).toBe("");
      expect(args[5]).toBe("");
    }
  });

  it("leaves the status chip counts untouched", () => {
    const counts = { total: 24, not_generated: 5, draft: 4, scheduled: 12, posted: 3 };
    expect(statusChipCount("draft", counts)).toBe(9);
    expect(statusChipCount("all", counts)).toBe(24);
    expect(buildGridQueryArgs(custom, [], 12, now)[11]).toBeUndefined();
  });
});
