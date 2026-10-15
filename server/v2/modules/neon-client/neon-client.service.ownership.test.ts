import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./neon-client.repository", () => ({
  neonClientRepository: { create: vi.fn(), update: vi.fn() },
}));
vi.mock("../client/client.repository", () => ({ clientRepository: {} }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));

import { neonClientService } from "./neon-client.service";
import { neonClientRepository } from "./neon-client.repository";
import { branchRepository } from "../branch/branch.repository";
import type { Scope } from "../../utils/scope";

const AGENT: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};
const ADMIN: Scope = { ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] };

beforeEach(() => vi.clearAllMocks());

describe("neonClientService ownership fields", () => {
  it("update strips orgId/branchId/createdBy for non-admins", async () => {
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.updateNeonClient("c1", { firstName: "X", orgId: "evil", branchId: "b", createdBy: "u" } as never, AGENT);
    expect(vi.mocked(neonClientRepository.update).mock.calls[0][1]).toEqual({ firstName: "X" });
  });

  it("update lets an admin pick a branch of their org and 400s on a foreign one", async () => {
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValueOnce({ id: "b2" } as never);
    await neonClientService.updateNeonClient("c1", { branchId: "b2" } as never, ADMIN);
    expect(vi.mocked(neonClientRepository.update).mock.calls[0][1]).toEqual({ branchId: "b2" });
    vi.mocked(branchRepository.findById).mockResolvedValueOnce(null);
    await expect(neonClientService.updateNeonClient("c1", { branchId: "x" } as never, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("create never lets the body choose the org", async () => {
    vi.mocked(neonClientRepository.create).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.createNeonClient({ firstName: "A", orgId: "evil" } as never, AGENT);
    expect(vi.mocked(neonClientRepository.create).mock.calls[0][0]).not.toHaveProperty("orgId");
  });
});
