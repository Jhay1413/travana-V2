import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.repository", () => ({
  clientRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByIdIncludingDeleted: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));

import { clientService } from "./client.service";
import { branchRepository } from "../branch/branch.repository";
import { clientRepository } from "./client.repository";

const SCOPE = { orgId: "o1", orgRole: "agent" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clientService.getClientById", () => {
  it("throws 404 when the (scoped) client is not found", async () => {
    vi.mocked(clientRepository.findById).mockResolvedValue(undefined as never);

    await expect(clientService.getClientById("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientRepository.findById).toHaveBeenCalledWith("c1", SCOPE);
  });

  it("returns the client when found", async () => {
    vi.mocked(clientRepository.findById).mockResolvedValue({ id: "c1" } as never);
    await expect(clientService.getClientById("c1", SCOPE)).resolves.toMatchObject({ id: "c1" });
  });
});

describe("clientService.createClient", () => {
  it("forwards data + scope to the repository", async () => {
    vi.mocked(clientRepository.create).mockResolvedValue({ id: "c1" } as never);

    await clientService.createClient({ firstName: "Ada" } as never, SCOPE);

    expect(clientRepository.create).toHaveBeenCalledWith({ firstName: "Ada" }, SCOPE);
  });
});

describe("clientService.updateClient", () => {
  it("throws 404 when the update misses (out of scope / missing)", async () => {
    vi.mocked(clientRepository.update).mockResolvedValue(undefined as never);

    await expect(clientService.updateClient("c1", { firstName: "X" } as never, SCOPE)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("clientService.deleteClient (soft delete)", () => {
  const ADMIN = { orgId: "o1", orgRole: "org_admin", userId: "admin1" } as never;
  const live = { id: "c1", status: "active", deletedAt: null };

  it("soft-deletes in scope, stamping the acting user", async () => {
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue(live as never);
    vi.mocked(clientRepository.softDelete).mockResolvedValue(true);
    await expect(clientService.deleteClient("c1", ADMIN)).resolves.toBeUndefined();
    expect(clientRepository.softDelete).toHaveBeenCalledWith("c1", ADMIN, "admin1");
  });

  it.each(["agent", "branch_manager", "homeworker", "social_media_manager"])("refuses %s with 403", async (orgRole) => {
    await expect(clientService.deleteClient("c1", { orgId: "o1", orgRole } as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(clientRepository.softDelete).not.toHaveBeenCalled();
  });

  it("allows platform_admin", async () => {
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue(live as never);
    vi.mocked(clientRepository.softDelete).mockResolvedValue(true);
    await expect(clientService.deleteClient("c1", { orgId: "o1", orgRole: "platform_admin", userId: "p" } as never)).resolves.toBeUndefined();
  });

  it("404s for an out-of-scope client", async () => {
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue(undefined);
    await expect(clientService.deleteClient("c9", ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientRepository.softDelete).not.toHaveBeenCalled();
  });

  it("409s when already deleted", async () => {
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue({ ...live, deletedAt: new Date() } as never);
    await expect(clientService.deleteClient("c1", ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(clientRepository.softDelete).not.toHaveBeenCalled();
  });

  it("400s for a merged client", async () => {
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue({ ...live, status: "merged" } as never);
    await expect(clientService.deleteClient("c1", ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s if the row vanished between check and update", async () => {
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue(live as never);
    vi.mocked(clientRepository.softDelete).mockResolvedValue(false);
    await expect(clientService.deleteClient("c1", ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("clientService.updateClient ownership fields (S3)", () => {
  it("strips orgId/branchId/createdBy before the repository for a non-admin", async () => {
    vi.mocked(clientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await clientService.updateClient("c1", { firstName: "X", orgId: "evil", branchId: "b", createdBy: "u" } as never, { orgId: "o1", orgRole: "agent" } as never);
    expect(vi.mocked(clientRepository.update).mock.calls[0][1]).toEqual({ firstName: "X" });
  });

  it("lets an admin move a client to a branch in their org, and 400s otherwise", async () => {
    vi.mocked(clientRepository.update).mockResolvedValue({ id: "c1" } as never);
    const admin = { orgId: "o1", orgRole: "org_admin" } as never;
    vi.mocked(branchRepository.findById).mockResolvedValueOnce({ id: "b2" } as never);
    await clientService.updateClient("c1", { branchId: "b2" } as never, admin);
    expect(vi.mocked(clientRepository.update).mock.calls[0][1]).toEqual({ branchId: "b2" });

    vi.mocked(branchRepository.findById).mockResolvedValueOnce(null);
    await expect(clientService.updateClient("c1", { branchId: "foreign" } as never, admin)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("clientService.viewClientById (client page read)", () => {
  const deleted = { id: "c1", deletedAt: new Date() };

  it("returns a live client for anyone in scope", async () => {
    vi.mocked(clientRepository.findById).mockResolvedValue({ id: "c1", deletedAt: null } as never);
    await expect(clientService.viewClientById("c1", SCOPE)).resolves.toMatchObject({ id: "c1" });
    expect(clientRepository.findByIdIncludingDeleted).not.toHaveBeenCalled();
  });

  it.each(["org_admin", "platform_admin"])("lets %s open a deleted client (row carries deletedAt)", async (orgRole) => {
    vi.mocked(clientRepository.findById).mockResolvedValue(undefined);
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue(deleted as never);
    const res = await clientService.viewClientById("c1", { orgId: "o1", orgRole } as never);
    expect(res.deletedAt).toBeTruthy();
  });

  it.each(["agent", "branch_manager", "homeworker", "social_media_manager"])("%s gets 404 for a deleted client", async (orgRole) => {
    vi.mocked(clientRepository.findById).mockResolvedValue(undefined);
    await expect(clientService.viewClientById("c1", { orgId: "o1", orgRole } as never)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientRepository.findByIdIncludingDeleted).not.toHaveBeenCalled();
  });

  it("404s for an admin when the client is out of scope", async () => {
    vi.mocked(clientRepository.findById).mockResolvedValue(undefined);
    vi.mocked(clientRepository.findByIdIncludingDeleted).mockResolvedValue(undefined);
    await expect(clientService.viewClientById("c9", { orgId: "o1", orgRole: "org_admin" } as never)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("writes on a deleted client stay blocked: update 404s because the strict lookup hides it", async () => {
    vi.mocked(clientRepository.update).mockResolvedValue(undefined);
    await expect(clientService.updateClient("c1", { firstName: "X" }, { orgId: "o1", orgRole: "org_admin" } as never)).rejects.toMatchObject({ statusCode: 404 });
  });
});
