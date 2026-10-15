import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./auth/storage", () => ({ authStorage: { getUser: vi.fn() } }));
vi.mock("../modules/branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserId: vi.fn() },
}));
vi.mock("../modules/user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));

import { orgBranchScope } from "./org-branch-scope";
import { authStorage } from "./auth/storage";
import { branchMemberRepository } from "../modules/branch-member/branch-member.repository";
import { userOrgRolesRepository } from "../modules/user-org-roles/user-org-roles.repository";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

async function run(userId: string, role: string) {
  vi.mocked(authStorage.getUser).mockResolvedValue({ id: userId, role: null, orgId: "org1", orgRole: role } as never);
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([role] as never);
  const req: any = { user: { id: userId }, session: {} };
  const next = vi.fn();
  await orgBranchScope(req, mockRes(), next);
  expect(next).toHaveBeenCalledOnce();
  return req;
}

beforeEach(() => vi.clearAllMocks());

describe("orgBranchScope branch context", () => {
  it("homeworker owning their homeworker branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "hw1", orgRole: "homeworker", branchType: "homeworker", ownerUserId: "u1",
    } as never);
    const req = await run("u1", "homeworker");
    expect(req.branchId).toBe("hw1");
    expect(req.branchType).toBe("homeworker");
    expect(req.ownsHomeworkerBranch).toBe(true);
  });

  it("homeworker in the legacy shared branch does not own it", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "shared", orgRole: "homeworker", branchType: "homeworker", ownerUserId: null,
    } as never);
    const req = await run("u1", "homeworker");
    expect(req.branchType).toBe("homeworker");
    expect(req.ownsHomeworkerBranch).toBe(false);
  });

  it("homeworker branch owned by someone else is not owned", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "hw2", orgRole: "homeworker", branchType: "homeworker", ownerUserId: "u2",
    } as never);
    const req = await run("u1", "homeworker");
    expect(req.ownsHomeworkerBranch).toBe(false);
  });

  it("shop agent", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "b1", orgRole: "agent", branchType: "shop", ownerUserId: null,
    } as never);
    const req = await run("u1", "agent");
    expect(req.branchType).toBe("shop");
    expect(req.ownsHomeworkerBranch).toBe(false);
  });

  it("no membership leaves branchType null", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    const req = await run("u1", "org_admin");
    expect(req.branchId).toBeNull();
    expect(req.branchType).toBeNull();
    expect(req.ownsHomeworkerBranch).toBe(false);
  });
});
