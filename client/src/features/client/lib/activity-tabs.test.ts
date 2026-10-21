import { describe, expect, it } from "vitest";
import { activityTabs, defaultActivityTab } from "./activity-tabs";

const values = (input: Parameters<typeof activityTabs>[0]) => activityTabs(input).map((t) => t.value);

describe("activityTabs", () => {
  it("shows all four tabs to an agent with a client", () => {
    expect(values({ isHomeworker: false, hasClient: true, readOnly: false })).toEqual(["messages", "notes", "tasks", "tickets"]);
  });

  it("drops Messages for homeworkers", () => {
    expect(values({ isHomeworker: true, hasClient: true, readOnly: false })).toEqual(["notes", "tasks", "tickets"]);
  });

  it("drops Messages and Tickets without a client", () => {
    expect(values({ isHomeworker: false, hasClient: false, readOnly: false })).toEqual(["notes", "tasks"]);
  });

  it("drops Tickets for read-only roles", () => {
    expect(values({ isHomeworker: false, hasClient: true, readOnly: true })).toEqual(["messages", "notes", "tasks"]);
  });
});

describe("defaultActivityTab", () => {
  it("is Messages when present", () => {
    expect(defaultActivityTab(activityTabs({ isHomeworker: false, hasClient: true, readOnly: false }))).toBe("messages");
  });

  it("is Notes when Messages is hidden", () => {
    expect(defaultActivityTab(activityTabs({ isHomeworker: true, hasClient: true, readOnly: false }))).toBe("notes");
  });
});
