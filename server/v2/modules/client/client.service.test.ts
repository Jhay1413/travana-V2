import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.repository", () => ({
  clientRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));

vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));

import { clientService } from "./client.service";
import { branchRepository } from "../branch/branch.repository";
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

describe("clientService.deleteClient", () => {
  it("throws 404 when nothing was removed", async () => {
    vi.mocked(clientRepository.remove).mockResolvedValue(false as never);

    await expect(clientService.deleteClient("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves when the client is removed", async () => {
    vi.mocked(clientRepository.remove).mockResolvedValue(true as never);

    await expect(clientService.deleteClient("c1", SCOPE)).resolves.toBeUndefined();
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
