import { describe, expect, it } from "vitest";
import { isClientReadOnly } from "./client-access";

describe("isClientReadOnly", () => {
  it("is true only for the social media manager", () => {
    expect(isClientReadOnly("social_media_manager")).toBe(true);
    for (const role of ["agent", "org_admin", "branch_manager", "homeworker", "platform_admin", "referral_agent", null, undefined]) {
      expect(isClientReadOnly(role)).toBe(false);
    }
  });
});
