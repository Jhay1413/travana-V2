import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.repository", () => ({ clientRepository: { create: vi.fn(), update: vi.fn(), findById: vi.fn() } }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { findById: vi.fn() } }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));

import { clientService } from "./client.service";
import { clientRepository } from "./client.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clientRepository.create).mockResolvedValue({ id: "c1" } as never);
  vi.mocked(clientRepository.update).mockResolvedValue({ id: "c1" } as never);
  vi.mocked(clientRepository.findById).mockResolvedValue({ id: "c1", referredByClientId: null } as never);
});

describe("clientService write guards (/api/v2/clients)", () => {
  const evil = { firstName: "X", portalPin: "1234", status: "merged", vipTier: "elite", mustChangePin: true } as never;

  it("strips system-managed fields on create and update", async () => {
    await clientService.createClient(evil, SCOPE);
    expect(vi.mocked(clientRepository.create).mock.calls[0][0]).toEqual({ firstName: "X" });
    await clientService.updateClient("c1", evil, SCOPE);
    expect(vi.mocked(clientRepository.update).mock.calls[0][1]).toEqual({ firstName: "X" });
  });

  it("rejects an out-of-scope referrer with 400", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    await expect(clientService.updateClient("c1", { referredByClientId: "foreign" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    await expect(clientService.createClient({ firstName: "A", referredByClientId: "foreign" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });
});
