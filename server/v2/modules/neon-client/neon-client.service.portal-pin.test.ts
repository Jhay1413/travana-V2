import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("./neon-client.repository", () => ({
  neonClientRepository: { findById: vi.fn(), setPortalPin: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("../client/client.repository", () => ({ clientRepository: {} }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({ fireAutoTriggerForClient: vi.fn().mockResolvedValue({}) }));

import { neonClientService } from "./neon-client.service";
import { neonClientRepository } from "./neon-client.repository";
import { fireAutoTriggerForClient } from "../sms/sms.service";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", portalPin: "hash", mustChangePin: true } as never);
});

describe("portal PIN service", () => {
  it("status reports hasPin / mustChangePin and never the hash", async () => {
    const status = await neonClientService.getPortalPinStatus("c1", SCOPE);
    expect(status).toEqual({ hasPin: true, mustChangePin: true });
    expect(neonClientRepository.findById).toHaveBeenCalledWith("c1", SCOPE);
  });

  it("set stores a bcrypt hash (not the PIN) and fires on_pin_set", async () => {
    const status = await neonClientService.setPortalPin("c1", "1234", SCOPE);
    expect(status).toEqual({ hasPin: true, mustChangePin: false });
    const stored = vi.mocked(neonClientRepository.setPortalPin).mock.calls[0][1] as string;
    expect(stored).not.toBe("1234");
    expect(await bcrypt.compare("1234", stored)).toBe(true);
    expect(fireAutoTriggerForClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "c1", autoTrigger: "on_pin_set" }),
    );
  });

  it("remove clears the hash", async () => {
    await neonClientService.removePortalPin("c1", SCOPE);
    expect(neonClientRepository.setPortalPin).toHaveBeenCalledWith("c1", null);
  });

  it("all three 404 for an out-of-scope client and write nothing", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    await expect(neonClientService.getPortalPinStatus("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(neonClientService.setPortalPin("c1", "1234", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(neonClientService.removePortalPin("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientRepository.setPortalPin).not.toHaveBeenCalled();
    expect(fireAutoTriggerForClient).not.toHaveBeenCalled();
  });
});

describe("referrer and system-field guards", () => {
  const ref = (over: object) =>
    vi.mocked(neonClientRepository.findById).mockImplementation(
      async (id: string) =>
        (id === "c1" ? { id: "c1" } : id === "r1" ? { id: "r1", status: "active", ...over } : undefined) as never,
    );

  beforeEach(() => {
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
  });

  it("accepts an active in-scope referrer", async () => {
    ref({});
    await neonClientService.updateNeonClient("c1", { referredByClientId: "r1" }, SCOPE);
    expect(neonClientRepository.update).toHaveBeenCalled();
  });

  it("rejects self, out-of-scope and merged referrers with 400", async () => {
    ref({});
    await expect(neonClientService.updateNeonClient("c1", { referredByClientId: "c1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    await expect(neonClientService.updateNeonClient("c1", { referredByClientId: "other-org" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    ref({ status: "merged" });
    await expect(neonClientService.updateNeonClient("c1", { referredByClientId: "r1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(neonClientRepository.update).not.toHaveBeenCalled();
  });

  it("allows clearing the referrer", async () => {
    await neonClientService.updateNeonClient("c1", { referredByClientId: null }, SCOPE);
    expect(neonClientRepository.update).toHaveBeenCalled();
  });

  it("strips system-managed fields from update and create", async () => {
    vi.mocked(neonClientRepository.create).mockResolvedValue({ id: "c1" } as never);
    const evil = { firstName: "X", portalPin: "1234", mustChangePin: true, status: "merged", mergedIntoId: "m", vipTier: "elite" } as never;
    await neonClientService.updateNeonClient("c1", evil, SCOPE);
    expect(vi.mocked(neonClientRepository.update).mock.calls[0][1]).toEqual({ firstName: "X" });
    await neonClientService.createNeonClient(evil, SCOPE);
    expect(vi.mocked(neonClientRepository.create).mock.calls[0][0]).toEqual({ firstName: "X" });
  });
});
