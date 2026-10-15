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

vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: {
    findActiveContextByUserIdInOrg: vi.fn(),
    findActiveContextByUserId: vi.fn(),
  },
}));

vi.mock("../branch/branch.repository", () => ({
  branchRepository: { findById: vi.fn() },
}));

import { ticketService } from "./ticket.service";
import { branchRepository } from "../branch/branch.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { ticketRepository } from "./ticket.repository";
import { notificationRepository } from "../notification/notification.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1",
  branchId: null,
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "shop" } as never);
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

describe("ticket assignment across the shop/homeworker partition", () => {
  const HOMEWORKER_SCOPE: Scope = {
    ...SCOPE,
    orgRole: "homeworker",
    orgRoles: ["homeworker"],
    branchId: "hw-branch",
    branchType: "homeworker",
    ownsHomeworkerBranch: true,
  };

  it("rejects (400) a shop caller assigning to a homeworker on create", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "homeworker" } as never);
    await expect(ticketService.createTicket({ assignedTo: "hw1", subject: "S" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("rejects (400) a shop caller reassigning to a homeworker on update", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "homeworker" } as never);
    await expect(ticketService.updateTicket("t1", { assignedTo: "hw1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.update).not.toHaveBeenCalled();
  });

  it("rejects (400) a homeworker assigning to a shop user", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "shop" } as never);
    await expect(ticketService.createTicket({ assignedTo: "u9", subject: "S" } as never, HOMEWORKER_SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows same-side assignment (shop to shop)", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", assignedTo: "u2", subject: "S" } as never);
    await expect(ticketService.createTicket({ assignedTo: "u2", subject: "S" } as never, SCOPE)).resolves.toBeDefined();
  });

  it("rejects an assignee with no active membership in the org (400)", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", assignedTo: "u2", subject: "S" } as never);
    await expect(ticketService.createTicket({ assignedTo: "u2", subject: "S" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not look anything up when there is no assignee or it is the caller", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);
    await ticketService.createTicket({ subject: "S" } as never, SCOPE);
    await ticketService.createTicket({ assignedTo: "u1", subject: "S" } as never, SCOPE);
    expect(branchMemberRepository.findActiveContextByUserIdInOrg).not.toHaveBeenCalled();
  });
});

describe("admin assignment across the partition re-homes the ticket", () => {
  const ADMIN: Scope = { ...SCOPE, orgRole: "org_admin", orgRoles: ["org_admin"], branchId: "shop1" };

  it("create: org_admin assigning to an owner of a homeworker branch sets branchId to that branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "homeworker", branchId: "hw-branch", orgId: "org1" } as never);
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", assignedTo: "hw1", subject: "S" } as never);

    await ticketService.createTicket({ assignedTo: "hw1", subject: "S" } as never, ADMIN);

    expect(vi.mocked(ticketRepository.create).mock.calls[0][0]).toMatchObject({ branchId: "hw-branch" });
  });

  it("update: org_admin reassigning to a homeworker re-homes via branchId", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "homeworker", branchId: "hw-branch", orgId: "org1" } as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "u2", branchId: "shop1" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "hw1", subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: "hw1" }, ADMIN);

    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).toMatchObject({ assignedTo: "hw1", branchId: "hw-branch" });
  });

  it("update: org_admin moving a homeworker-branch ticket to shop staff re-homes to the assignee's branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "shop", branchId: "shop2", orgId: "org1" } as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "hw1", branchId: "hw-branch" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "hw-branch", branchType: "homeworker" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "u2", subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: "u2" }, ADMIN);

    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).toMatchObject({ assignedTo: "u2", branchId: "shop2" });
  });

  it("update: org_admin assigning a shop ticket to shop staff leaves branchId alone", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "shop", branchId: "shop2", orgId: "org1" } as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "u3", branchId: "shop1" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "shop1", branchType: "shop" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "u2", subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: "u2" }, ADMIN);

    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).not.toHaveProperty("branchId");
  });

  it("platform_admin may also assign across the partition", async () => {
    const platform: Scope = { ...SCOPE, orgRole: "platform_admin", orgRoles: ["platform_admin"], branchId: null };
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "homeworker", branchId: "hw-branch", orgId: "org1" } as never);
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", assignedTo: "hw1", subject: "S" } as never);

    await expect(ticketService.createTicket({ assignedTo: "hw1", subject: "S" } as never, platform)).resolves.toBeDefined();
    expect(vi.mocked(ticketRepository.create).mock.calls[0][0]).toMatchObject({ branchId: "hw-branch" });
  });

  it("a non-admin (branch_manager) still gets 400 across the partition", async () => {
    const bm: Scope = { ...SCOPE, orgRole: "branch_manager", orgRoles: ["branch_manager"] };
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchType: "homeworker", branchId: "hw-branch", orgId: "org1" } as never);
    await expect(ticketService.createTicket({ assignedTo: "hw1", subject: "S" } as never, bm)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("assignee must belong to the caller's org (S1)", () => {
  it("rejects with 400 when the assignee has no active membership in scope.orgId", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
    await expect(ticketService.createTicket({ assignedTo: "foreign", subject: "S" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.findActiveContextByUserIdInOrg).toHaveBeenCalledWith("foreign", "org1");
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("applies to updates too", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
    await expect(ticketService.updateTicket("t1", { assignedTo: "foreign" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.update).not.toHaveBeenCalled();
  });

  it("a non-impersonating platform_admin (orgId '') is not org-filtered and re-homes a homeworker-branch ticket to shop staff", async () => {
    const platform: Scope = { ...SCOPE, orgId: "", orgRole: "platform_admin", orgRoles: ["platform_admin"], branchId: null };
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({ branchType: "shop", branchId: "shop2", orgId: "org1" } as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", assignedTo: "hw1", branchId: "hw-branch" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "hw-branch", branchType: "homeworker" } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1", assignedTo: "u2", subject: "S" } as never);

    await ticketService.updateTicket("t1", { assignedTo: "u2" }, platform);

    expect(branchMemberRepository.findActiveContextByUserIdInOrg).not.toHaveBeenCalled();
    expect(branchRepository.findById).toHaveBeenCalledWith("hw-branch", "org1");
    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).toMatchObject({ branchId: "shop2" });
  });
});

describe("createTicket does not trust body orgId/branchId (S2)", () => {
  const ADMIN: Scope = { ...SCOPE, orgRole: "org_admin", orgRoles: ["org_admin"], branchId: "shop1" };

  it("always strips orgId, and strips branchId for non-admins", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);
    await ticketService.createTicket({ subject: "S", orgId: "evil", branchId: "evil-branch" } as never, SCOPE);
    const sent = vi.mocked(ticketRepository.create).mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("orgId");
    expect(sent).not.toHaveProperty("branchId");
    expect(branchRepository.findById).not.toHaveBeenCalled();
  });

  it("lets an admin choose a branch inside their org", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b2" } as never);
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);
    await ticketService.createTicket({ subject: "S", branchId: "b2" } as never, ADMIN);
    expect(branchRepository.findById).toHaveBeenCalledWith("b2", "org1");
    expect(vi.mocked(ticketRepository.create).mock.calls[0][0]).toMatchObject({ branchId: "b2" });
  });

  it("rejects an admin's branch from another org with 400", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(null);
    await expect(ticketService.createTicket({ subject: "S", branchId: "foreign" } as never, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });
});
