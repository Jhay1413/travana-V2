import { describe, expect, it } from "vitest";
import { deviceKind, deviceLabel, formatDay, recentViews, timeAgo, viewDayLabel } from "./quote-views";

const entry = (id: string, viewedAt: string, deviceType: string | null = "mobile", browser: string | null = "Safari") => ({
  id,
  viewedAt,
  deviceType,
  browser,
});

describe("deviceLabel", () => {
  it("combines the device and browser", () => {
    expect(deviceLabel("mobile", "Safari")).toBe("Phone, Safari");
    expect(deviceLabel("desktop", "Chrome")).toBe("Computer, Chrome");
  });
  it("drops an unknown browser and handles missing data", () => {
    expect(deviceLabel("tablet", "Unknown")).toBe("Tablet");
    expect(deviceLabel(null, null)).toBe("Unknown device");
    expect(deviceKind("watch")).toBe("unknown");
  });
});

describe("recentViews", () => {
  const stats = {
    clientViews: [
      { ...entry("1", "2026-10-10T10:00:00Z"), viewerName: "Jimmy Bouy" },
      { ...entry("2", "2026-10-12T10:00:00Z", "desktop", "Chrome"), viewerName: "Jimmy Bouy" },
    ],
    publicViews: [entry("3", "2026-10-11T10:00:00Z"), entry("4", "2026-10-13T10:00:00Z")],
  };

  it("merges both logs newest first", () => {
    expect(recentViews(stats).map((v) => v.id)).toEqual(["p-4", "c-2", "p-3", "c-1"]);
  });
  it("tags each view with its source and viewer", () => {
    const [first, second] = recentViews(stats);
    expect(first).toMatchObject({ source: "public", viewerName: null, deviceKind: "mobile" });
    expect(second).toMatchObject({ source: "client", viewerName: "Jimmy Bouy", device: "Computer, Chrome" });
  });
  it("caps the list and tolerates missing stats", () => {
    expect(recentViews(stats, 2)).toHaveLength(2);
    expect(recentViews(undefined)).toEqual([]);
    expect(recentViews({ clientViews: [], publicViews: [] })).toEqual([]);
  });
});

describe("date helpers", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("formats a day", () => {
    expect(formatDay("2026-10-12T12:00:00Z")).toBe("12 Oct 2026");
    expect(formatDay(null)).toBe("");
    expect(formatDay("nope")).toBe("");
  });
  it("describes how long ago", () => {
    expect(timeAgo("2026-10-21T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-21T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-10-21T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-19T12:00:00Z", now)).toBe("2 days ago");
    expect(timeAgo("2026-08-01T12:00:00Z", now)).toBe("1 Aug 2026");
  });
  it("labels the day of a view", () => {
    expect(viewDayLabel("2026-10-21T10:00:00Z", now)).toBe("Today");
    expect(viewDayLabel("2026-10-20T12:00:00Z", now)).toBe("Yesterday");
    expect(viewDayLabel("2026-10-12T12:00:00Z", now)).toBe("12 Oct");
  });
});
