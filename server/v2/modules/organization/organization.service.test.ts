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

vi.mock("../plan/plan.repository", () => ({ planRepository: { findByCode: vi.fn() } }));

import { organizationService } from "./organization.service";
import { organizationRepository } from "./organization.repository";
import { planRepository } from "../plan/plan.repository";

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

  it("passes settings through as a patch without pre-reading the org", async () => {
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { name: "N", settings: { currency: "USD" } } as never);

    expect(organizationRepository.findById).not.toHaveBeenCalled();
    expect(vi.mocked(organizationRepository.update).mock.calls[0][1]).toEqual({ name: "N", settings: { currency: "USD" } });
  });

  it("ignores a stale server-owned onboarding key but still merges other keys", async () => {
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { settings: { onboarding: { status: "pending" }, currency: "USD" } } as never);

    expect(vi.mocked(organizationRepository.update).mock.calls[0][1].settings).toEqual({ currency: "USD" });
  });

  it("throws 404 when a settings update finds no organization", async () => {
    vi.mocked(organizationRepository.update).mockResolvedValue(null as never);
    await expect(organizationService.update("o1", { settings: { a: 1 } } as never)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("copies the new plan's seat limit onto the organisation", async () => {
    vi.mocked(planRepository.findByCode).mockResolvedValue({ code: "growth", seatLimit: 25 } as never);
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { plan: "growth" });

    expect(planRepository.findByCode).toHaveBeenCalledWith("growth");
    expect(vi.mocked(organizationRepository.update).mock.calls[0][1]).toMatchObject({ plan: "growth", seatLimit: 25 });
  });

  it("sets seatLimit to null (unlimited) when the plan has no seat cap", async () => {
    vi.mocked(planRepository.findByCode).mockResolvedValue({ code: "enterprise", seatLimit: null } as never);
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { plan: "enterprise" });

    expect(vi.mocked(organizationRepository.update).mock.calls[0][1]).toMatchObject({ seatLimit: null });
  });

  it("keeps an explicit seatLimit (platform admin) and skips the plan lookup", async () => {
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { plan: "growth", seatLimit: 40 });

    expect(planRepository.findByCode).not.toHaveBeenCalled();
    expect(vi.mocked(organizationRepository.update).mock.calls[0][1]).toMatchObject({ seatLimit: 40 });
  });

  it("leaves seatLimit alone when the plan row is missing", async () => {
    vi.mocked(planRepository.findByCode).mockResolvedValue(null as never);
    vi.mocked(organizationRepository.update).mockResolvedValue({ id: "o1" } as never);

    await organizationService.update("o1", { plan: "growth" });

    expect(vi.mocked(organizationRepository.update).mock.calls[0][1]).not.toHaveProperty("seatLimit");
  });

  it("throws 404 when the org to update is missing", async () => {
    vi.mocked(organizationRepository.update).mockResolvedValue(undefined as never);
    await expect(organizationService.update("o1", { name: "New" })).rejects.toMatchObject({ statusCode: 404 });
  });
});
