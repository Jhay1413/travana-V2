import { describe, it, expect } from "vitest";
import { INBOX_SOCIAL_ROLES, MY_TARGETS_ROLES, SOCIAL_ROLES, omitHomeworkerDeniedTabs } from "./homeworker-access";

describe("MY_TARGETS_ROLES", () => {
  it("is homeworkers only: admins and managers set targets on their own pages", () => {
    expect(MY_TARGETS_ROLES).toEqual(["homeworker"]);
  });
});

describe("INBOX_SOCIAL_ROLES", () => {
  it("excludes homeworker and non-staff roles", () => {
    expect(INBOX_SOCIAL_ROLES).not.toContain("homeworker");
    expect(INBOX_SOCIAL_ROLES).not.toContain("referral_agent");
    expect(INBOX_SOCIAL_ROLES).toContain("agent");
    expect(INBOX_SOCIAL_ROLES).toContain("org_admin");
    expect(INBOX_SOCIAL_ROLES).not.toContain("social_media_manager");
  });
});

describe("SOCIAL_ROLES", () => {
  it("is the inbox roles plus the social media manager", () => {
    expect(SOCIAL_ROLES).toEqual([...INBOX_SOCIAL_ROLES, "social_media_manager"]);
    expect(SOCIAL_ROLES).not.toContain("homeworker");
    expect(SOCIAL_ROLES).not.toContain("referral_agent");
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
