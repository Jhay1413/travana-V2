import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./neon-client.repository", () => ({
  neonClientRepository: { findById: vi.fn(), bulkInsert: vi.fn(), update: vi.fn() },
}));
vi.mock("../client/client.repository", () => ({ clientRepository: {} }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({ fireAutoTriggerForClient: vi.fn() }));

import { neonClientService } from "./neon-client.service";
import { neonClientRepository } from "./neon-client.repository";
import type { Scope } from "../../utils/scope";

const BM: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "branch_manager", orgRoles: ["branch_manager"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(neonClientRepository.bulkInsert).mockImplementation(async (rows) => ({ imported: rows.length, errors: [] }));
});

describe("bulkImportClients", () => {
  it("strips system-managed fields from every row", async () => {
    await neonClientService.bulkImportClients(
      [{ firstName: "A", portalPin: "1234", status: "merged", vipTier: "elite" } as never],
      BM,
    );
    expect(vi.mocked(neonClientRepository.bulkInsert).mock.calls[0][0]).toEqual([{ firstName: "A" }]);
  });

  it("turns a bad referrer into a row error and still imports the rest", async () => {
    vi.mocked(neonClientRepository.findById).mockImplementation(
      async (id: string) => (id === "ok" ? { id: "ok", status: "active" } : undefined) as never,
    );
    const result = await neonClientService.bulkImportClients(
      [{ firstName: "A" }, { firstName: "B", referredByClientId: "foreign" }, { firstName: "C", referredByClientId: "ok" }] as never,
      BM,
    );
    expect(result.imported).toBe(2);
    expect(result.errors).toEqual([{ row: 2, id: "-", error: "Referring client not found" }]);
  });

  it("maps repository row errors back to the original row numbers", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    vi.mocked(neonClientRepository.bulkInsert).mockResolvedValue({ imported: 1, errors: [{ row: 2, id: "-", error: "db" }] });
    const result = await neonClientService.bulkImportClients(
      [{ firstName: "A", referredByClientId: "bad" }, { firstName: "B" }, { firstName: "C" }] as never,
      BM,
    );
    expect(result.errors.map((e) => e.row)).toEqual([1, 3]);
  });
});

describe("referrer checks on update", () => {
  beforeEach(() => {
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
  });

  it("branch manager cannot pick a referrer outside their branch (scoped lookup misses, 400)", async () => {
    vi.mocked(neonClientRepository.findById).mockImplementation(
      async (id: string) => (id === "c1" ? { id: "c1", referredByClientId: null } : undefined) as never,
    );
    await expect(neonClientService.updateNeonClient("c1", { referredByClientId: "other-branch" }, BM)).rejects.toMatchObject({ statusCode: 400 });
    expect(vi.mocked(neonClientRepository.findById)).toHaveBeenCalledWith("other-branch", BM);
  });

  it("does not re-validate an unchanged referrer", async () => {
    vi.mocked(neonClientRepository.findById).mockImplementation(
      async (id: string) => (id === "c1" ? { id: "c1", referredByClientId: "legacy" } : undefined) as never,
    );
    await neonClientService.updateNeonClient("c1", { referredByClientId: "legacy" }, BM);
    expect(neonClientRepository.update).toHaveBeenCalled();
    expect(vi.mocked(neonClientRepository.findById)).not.toHaveBeenCalledWith("legacy", BM);
  });

  it("404s with Client not found when the client is out of scope", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    await expect(neonClientService.updateNeonClient("c1", { referredByClientId: "r" }, BM)).rejects.toMatchObject({
      statusCode: 404,
      message: "Client not found",
    });
  });
});
