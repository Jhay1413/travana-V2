import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../client/client.service", () => ({ clientService: {} }));
vi.mock("./neon-client.repository", () => ({
  neonClientRepository: { findById: vi.fn(), findByIdIncludingDeleted: vi.fn() },
}));
vi.mock("../client/client.repository", () => ({ clientRepository: {} }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: {} }));
vi.mock("../sms/sms.service", () => ({ fireAutoTriggerForClient: vi.fn() }));

import { neonClientService } from "./neon-client.service";
import { neonClientRepository } from "./neon-client.repository";

const AGENT = { orgId: "o1", orgRole: "agent", userId: "a1", branchId: "shop1" } as never;
const ADMIN = { orgId: "o1", orgRole: "org_admin", userId: "ad1" } as never;

beforeEach(() => vi.clearAllMocks());

describe("neonClientService.viewNeonClientById", () => {
  it("uses the org-wide neon client lookup (an agent can open another shop's client)", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c2", branchId: "shop2" } as never);
    await expect(neonClientService.viewNeonClientById("c2", AGENT)).resolves.toMatchObject({ id: "c2" });
    expect(neonClientRepository.findById).toHaveBeenCalledWith("c2", AGENT);
    expect(neonClientRepository.findByIdIncludingDeleted).not.toHaveBeenCalled();
  });

  it("404s a deleted client for an agent without looking it up", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    await expect(neonClientService.viewNeonClientById("c3", AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientRepository.findByIdIncludingDeleted).not.toHaveBeenCalled();
  });

  it("lets an admin open a deleted client read-only", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    vi.mocked(neonClientRepository.findByIdIncludingDeleted).mockResolvedValue({ id: "c3", deletedAt: new Date() } as never);
    await expect(neonClientService.viewNeonClientById("c3", ADMIN)).resolves.toMatchObject({ id: "c3" });
  });

  it("404s for an admin when the client is out of scope even with deleted rows included", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    vi.mocked(neonClientRepository.findByIdIncludingDeleted).mockResolvedValue(undefined);
    await expect(neonClientService.viewNeonClientById("c9", ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
});
