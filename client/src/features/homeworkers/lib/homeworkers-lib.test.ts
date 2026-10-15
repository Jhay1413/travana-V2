import { describe, it, expect } from "vitest";
import { validateProfitShare, formatProfitShare, defaultShareToInput } from "./profit-share";
import { statusChip, canArchive } from "./status";
import { buildInviteBody } from "./invite-body";
import type { HomeworkerStatus } from "../types";

describe("validateProfitShare", () => {
  it.each(["0", "100", "12.5", "12.55", "99.99", " 70 "])("accepts %s", (v) => {
    expect(validateProfitShare(v)).toBeNull();
  });
  it.each(["", "  ", "101", "100.01", "12.555", "-1", "abc", "1e2", "1,5"])("rejects %j", (v) => {
    expect(validateProfitShare(v)).not.toBeNull();
  });
});

describe("share formatting", () => {
  it("formats and handles null", () => {
    expect(formatProfitShare("12.50")).toBe("12.5%");
    expect(formatProfitShare(null)).toBe("–");
  });
  it("converts the org default to an input string", () => {
    expect(defaultShareToInput(60)).toBe("60");
    expect(defaultShareToInput(null)).toBe("");
    expect(defaultShareToInput(undefined)).toBe("");
  });
});

describe("status chips", () => {
  const statuses: HomeworkerStatus[] = ["pending", "active", "suspended", "archived"];
  it("maps every status to a distinct label", () => {
    const labels = statuses.map((s) => statusChip(s).label);
    expect(labels).toEqual(["Pending", "Active", "Suspended", "Archived"]);
  });
  it("only active and suspended can be archived", () => {
    expect(statuses.filter(canArchive)).toEqual(["active", "suspended"]);
  });
});

describe("buildInviteBody", () => {
  const base = { email: "  a@b.com ", branchId: "branch-1", profitSharePercent: " 70 ", displayName: " Jo " };
  it("homeworker: no branchId, trimmed share and name", () => {
    expect(buildInviteBody({ ...base, orgRole: "homeworker" })).toEqual({
      email: "a@b.com",
      orgRole: "homeworker",
      profitSharePercent: "70",
      displayName: "Jo",
    });
  });
  it("homeworker: omits empty optional fields", () => {
    expect(buildInviteBody({ ...base, orgRole: "homeworker", profitSharePercent: "", displayName: "" })).toEqual({
      email: "a@b.com",
      orgRole: "homeworker",
    });
  });
  it("other roles: branchId only, no homeworker fields", () => {
    expect(buildInviteBody({ ...base, orgRole: "agent" })).toEqual({
      email: "a@b.com",
      orgRole: "agent",
      branchId: "branch-1",
    });
  });
});
