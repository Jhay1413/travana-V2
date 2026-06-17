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

import { clientService } from "./client.service";
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
