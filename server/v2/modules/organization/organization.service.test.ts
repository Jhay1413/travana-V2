import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization.repository", () => ({
  organizationRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { organizationService } from "./organization.service";
import { organizationRepository } from "./organization.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("organizationService.getById", () => {
  it("throws 404 when the organization does not exist", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(undefined as never);
    await expect(organizationService.getById("o1")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("organizationService.update", () => {
  it("rejects a slug already used by another organization (409)", async () => {
    vi.mocked(organizationRepository.findBySlug).mockResolvedValue({ id: "other" } as never);

    await expect(organizationService.update("o1", { slug: "taken" })).rejects.toMatchObject({ statusCode: 409 });
    expect(organizationRepository.update).not.toHaveBeenCalled();
  });

  it("allows keeping the org's own slug", async () => {
    vi.mocked(organizationRepository.findBySlug).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await expect(organizationService.update("o1", { slug: "mine" })).resolves.toMatchObject({ id: "o1" });
  });

  it("deep-merges settings onto the existing settings", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue({ id: "o1", settings: { timezone: "UTC", currency: "GBP" } } as never);
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { settings: { currency: "USD" } } as never);

    // existing timezone preserved, currency overwritten
    expect(vi.mocked(organizationRepository.update).mock.calls[0][1].settings).toEqual({ timezone: "UTC", currency: "USD" });
  });

  it("throws 404 when the org to update is missing", async () => {
    vi.mocked(organizationRepository.update).mockResolvedValue(undefined as never);
    await expect(organizationService.update("o1", { name: "New" })).rejects.toMatchObject({ statusCode: 404 });
  });
});
