import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./neon-client.repository", () => ({
  neonClientRepository: { findById: vi.fn(), update: vi.fn() },
}));
vi.mock("../client/client.repository", () => ({ clientRepository: {} }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({ fireAutoTriggerForClient: vi.fn() }));

import { neonClientService } from "./neon-client.service";
import { neonClientRepository } from "./neon-client.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};

beforeEach(() => vi.clearAllMocks());

describe("updateNeonClient on a merged client", () => {
  it("refuses with 400 and writes nothing", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "merged" } as never);
    await expect(neonClientService.updateNeonClient("c1", { city: "X" }, SCOPE)).rejects.toMatchObject({
      statusCode: 400,
      message: "This client has already been merged into another client",
    });
    expect(neonClientRepository.findById).toHaveBeenCalledWith("c1", SCOPE);
    expect(neonClientRepository.update).not.toHaveBeenCalled();
  });

  it("refuses a merged client even when the body only clears the referrer", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "merged" } as never);
    await expect(neonClientService.updateNeonClient("c1", { referredByClientId: null }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(neonClientRepository.update).not.toHaveBeenCalled();
  });

  it("404s for an out-of-scope client", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    await expect(neonClientService.updateNeonClient("c1", { city: "X" }, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientRepository.update).not.toHaveBeenCalled();
  });

  it("still updates an active client", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "active" } as never);
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.updateNeonClient("c1", { city: "X" }, SCOPE);
    expect(neonClientRepository.update).toHaveBeenCalledWith("c1", { city: "X" }, SCOPE);
  });
});
