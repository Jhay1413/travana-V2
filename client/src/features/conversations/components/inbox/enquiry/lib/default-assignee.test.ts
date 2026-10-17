import { describe, expect, it } from "vitest";
import { defaultAssigneeId } from "./default-assignee";

const users = [
  { id: "u1", name: "Ann Lee", email: "ann@x.com" },
  { id: "u2", name: "", email: "bob@x.com" },
];

describe("defaultAssigneeId", () => {
  it("uses the conversation assignee, matched by name or email", () => {
    expect(defaultAssigneeId(users, "Ann Lee", "me")).toBe("u1");
    expect(defaultAssigneeId(users, "bob@x.com", "me")).toBe("u2");
  });
  it("falls back to the current user, then empty", () => {
    expect(defaultAssigneeId(users, "Nobody", "me")).toBe("me");
    expect(defaultAssigneeId([], null, "me")).toBe("me");
    expect(defaultAssigneeId([], null, undefined)).toBe("");
  });
});
