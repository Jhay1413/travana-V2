import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./ticket.repository", () => ({
  ticketRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByClientId: vi.fn(),
    findByAssignedTo: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleLike: vi.fn(),
  },
}));

import { ticketService } from "./ticket.service";
import { ticketRepository } from "./ticket.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1",
  branchId: null,
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ticketService.toggleLike", () => {
  it("returns the repository result", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1" } as never);
    vi.mocked(ticketRepository.toggleLike).mockResolvedValue({ liked: true, likeCount: 3 });

    await expect(ticketService.toggleLike("t1", "u1", SCOPE)).resolves.toEqual({
      liked: true,
      likeCount: 3,
    });
    expect(ticketRepository.toggleLike).toHaveBeenCalledWith("t1", "u1");
  });

  it("throws 404 when the ticket is outside the caller's scope", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(undefined);

    await expect(ticketService.toggleLike("t1", "u1", SCOPE)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(ticketRepository.toggleLike).not.toHaveBeenCalled();
  });
});

describe("ticketService.updateTicket", () => {
  it("sanitises description before saving", async () => {
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await ticketService.updateTicket(
      "t1",
      { description: '<p>hi</p><img src=x onerror="alert(1)"><script>x()</script>' },
      SCOPE
    );

    const [, savedData] = vi.mocked(ticketRepository.update).mock.calls[0];
    expect(savedData.description).toBe("<p>hi</p>");
  });
});
