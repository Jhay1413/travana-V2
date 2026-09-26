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

vi.mock("../notification/notification.repository", () => ({
  notificationRepository: {
    create: vi.fn(),
  },
}));

import { ticketService } from "./ticket.service";
import { ticketRepository } from "./ticket.repository";
import { notificationRepository } from "../notification/notification.repository";
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

  it("does not notify when the update leaves assignment untouched", async () => {
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "u2", subject: "S" } as never);

    await ticketService.updateTicket("t1", { subject: "New subject" }, SCOPE);

    expect(ticketRepository.findById).not.toHaveBeenCalled();
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("notifies the new assignee on reassignment to a different user", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "u2" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "u3", subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: "u3" }, SCOPE);

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u3", type: "ticket_assigned" })
    );
  });

  it("does not notify when reassigning to the same person already assigned", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "u2" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "u2", subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: "u2" }, SCOPE);

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it("does not notify when unassigning a ticket", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "u2" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: null, subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: null }, SCOPE);

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });
});

describe("ticketService.createTicket", () => {
  it("notifies the assignee when a ticket is created assigned to someone else", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", assignedTo: "u2", subject: "S" } as never);

    await ticketService.createTicket({ assignedTo: "u2", subject: "S" } as never, SCOPE);

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2", type: "ticket_assigned" })
    );
  });

  it("does not notify when the creator assigns the ticket to themselves", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", assignedTo: "u1", subject: "S" } as never);

    await ticketService.createTicket({ assignedTo: "u1", subject: "S" } as never, SCOPE);

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });
});
