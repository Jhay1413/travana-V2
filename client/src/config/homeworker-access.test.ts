import { describe, it, expect } from "vitest";
import { INBOX_SOCIAL_ROLES, omitHomeworkerDeniedTabs } from "./homeworker-access";

describe("INBOX_SOCIAL_ROLES", () => {
  it("excludes homeworker and non-staff roles", () => {
    expect(INBOX_SOCIAL_ROLES).not.toContain("homeworker");
    expect(INBOX_SOCIAL_ROLES).not.toContain("referral_agent");
    expect(INBOX_SOCIAL_ROLES).toContain("agent");
    expect(INBOX_SOCIAL_ROLES).toContain("org_admin");
  });
});

describe("omitHomeworkerDeniedTabs", () => {
  const tabs = [{ value: "tasks" }, { value: "conversations" }, { value: "chats" }];
  it("removes denied tabs for homeworkers", () => {
    expect(omitHomeworkerDeniedTabs(tabs, true, ["conversations", "chats"]).map((t) => t.value)).toEqual(["tasks"]);
  });
  it("keeps every tab for other roles", () => {
    expect(omitHomeworkerDeniedTabs(tabs, false, ["conversations", "chats"])).toHaveLength(3);
  });
});
