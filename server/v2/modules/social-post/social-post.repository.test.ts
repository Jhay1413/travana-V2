import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { socialPostRepository } from "./social-post.repository";
import { resetCapture, renderWhere } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const SMM: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "social_media_manager", orgRoles: ["social_media_manager"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};

beforeEach(() => resetCapture());

describe("socialPostRepository.quoteBelongsToOrg partition", () => {
  it("excludes homeworker branches when given a shop scope", async () => {
    await socialPostRepository.quoteBelongsToOrg("q1", "org1", SMM);
    expect(renderWhere(0).text).toContain('"transaction"."branch_id" NOT IN (SELECT');
  });

  it("stays org-only without a scope", async () => {
    await socialPostRepository.quoteBelongsToOrg("q1", "org1");
    expect(renderWhere(0).text).not.toContain("NOT IN (SELECT");
  });
});
