import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./opportunities.repository", () => ({
  opportunitiesRepository: {
    findAgentsAcrossPlatform: vi.fn().mockResolvedValue([{ id: "plat" }]),
    findSelfAsAgent: vi.fn().mockResolvedValue([{ id: "u1" }]),
    findAgentsInBranch: vi.fn().mockResolvedValue([{ id: "branch" }]),
    findAgentsInOrg: vi.fn().mockResolvedValue([{ id: "org" }]),
  },
}));

import { opportunitiesService } from "./opportunities.service";
import { opportunitiesRepository as repo } from "./opportunities.repository";

beforeEach(() => vi.clearAllMocks());

const base = { orgId: "o1", branchId: "b1", userId: "u1" };

describe("opportunitiesService.getAgents - picker scoping", () => {
  it("platform_admin gets the cross-org list", async () => {
    expect(
      await opportunitiesService.getAgents({ ...base, orgRole: "platform_admin", orgRoles: ["platform_admin"] } as never),
    ).toEqual([{ id: "plat" }]);
  });

  it("homeworker gets only themselves", async () => {
    const result = await opportunitiesService.getAgents({ ...base, orgRole: "homeworker", orgRoles: ["homeworker"] } as never);

    expect(result).toEqual([{ id: "u1" }]);
    expect(repo.findSelfAsAgent).toHaveBeenCalledWith("u1", "o1");
    expect(repo.findAgentsInOrg).not.toHaveBeenCalled();
    expect(repo.findAgentsInBranch).not.toHaveBeenCalled();
  });

  it("a user holding agent + homeworker is treated as a homeworker", async () => {
    await opportunitiesService.getAgents({ ...base, orgRole: "agent", orgRoles: ["agent", "homeworker"] } as never);

    expect(repo.findSelfAsAgent).toHaveBeenCalledWith("u1", "o1");
    expect(repo.findAgentsInBranch).not.toHaveBeenCalled();
  });

  it("homeworker without a user id gets an empty list", async () => {
    const result = await opportunitiesService.getAgents({
      ...base,
      userId: null,
      orgRole: "homeworker",
      orgRoles: ["homeworker"],
    } as never);

    expect(result).toEqual([]);
    expect(repo.findSelfAsAgent).not.toHaveBeenCalled();
  });

  it("agent and branch_manager get the branch list", async () => {
    for (const role of ["agent", "branch_manager"]) {
      vi.clearAllMocks();
      await opportunitiesService.getAgents({ ...base, orgRole: role, orgRoles: [role] } as never);
      expect(repo.findAgentsInBranch).toHaveBeenCalledWith("o1", "b1");
    }
  });

  it("org_admin gets the org-wide list", async () => {
    await opportunitiesService.getAgents({ ...base, orgRole: "org_admin", orgRoles: ["org_admin"] } as never);

    expect(repo.findAgentsInOrg).toHaveBeenCalledWith("o1", "b1", expect.objectContaining({ orgRole: "org_admin" }));
  });
});
