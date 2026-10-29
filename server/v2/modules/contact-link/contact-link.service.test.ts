import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Scope } from "../../utils/scope";

vi.mock("./contact-link.repository", () => ({
  contactLinkRepository: { findByContact: vi.fn(), link: vi.fn() },
}));
vi.mock("../neon-client/neon-client.service", () => ({
  neonClientService: { getNeonClientById: vi.fn() },
}));

import { neonClientService } from "../neon-client/neon-client.service";
import { contactLinkRepository } from "./contact-link.repository";
import { contactLinkService } from "./contact-link.service";

const scope = { orgId: "o1", userId: "u1" } as Scope;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1" } as never);
});

describe("linkIfUnlinked", () => {
  it("links an unlinked contact", async () => {
    vi.mocked(contactLinkRepository.findByContact).mockResolvedValue(null);
    await expect(contactLinkService.linkIfUnlinked("k1", "c1", scope)).resolves.toBe("linked");
    expect(contactLinkRepository.link).toHaveBeenCalledWith("o1", "k1", "c1", "u1");
  });

  it("does nothing when the contact is already linked to the same client", async () => {
    vi.mocked(contactLinkRepository.findByContact).mockResolvedValue({ clientId: "c1" } as never);
    await expect(contactLinkService.linkIfUnlinked("k1", "c1", scope)).resolves.toBe("already_linked");
    expect(contactLinkRepository.link).not.toHaveBeenCalled();
  });

  it("does not overwrite a link to a different client", async () => {
    vi.mocked(contactLinkRepository.findByContact).mockResolvedValue({ clientId: "c2" } as never);
    await expect(contactLinkService.linkIfUnlinked("k1", "c1", scope)).resolves.toBe("linked_to_other");
    expect(contactLinkRepository.link).not.toHaveBeenCalled();
  });
});
