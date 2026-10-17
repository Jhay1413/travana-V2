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
    findHolidayLinkTarget: vi.fn(),
    findClientRef: vi.fn(),
    findHolidaySummaries: vi.fn(),
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

vi.mock("../transaction/transaction.repository", () => ({
  transactionRepository: { findByIdScopedForWrite: vi.fn() },
}));

vi.mock("../branch/branch.repository", () => ({
  branchRepository: { findById: vi.fn() },
}));

import { ticketService, resolvedAtFor, buildHolidaySummary } from "./ticket.service";
import type { HolidayTransactionRow, HolidayQuoteRow } from "./ticket.types";
import { branchRepository } from "../branch/branch.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { ticketRepository } from "./ticket.repository";
import { transactionRepository } from "../transaction/transaction.repository";
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
  vi.mocked(ticketRepository.findClientRef).mockResolvedValue({ id: "c1", orgId: "org1" });
  vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "x1" } as never);
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

describe("resolvedAtFor", () => {
  const now = new Date("2026-10-16T10:00:00Z");
  const stamp = new Date("2026-10-01T09:00:00Z");

  it.each([
    ["Resolved", { status: "Open", resolvedAt: null }, now],
    ["Closed", { status: "In Progress", resolvedAt: null }, now],
    ["Resolved", undefined, now],
    ["Closed", { status: "Resolved", resolvedAt: null }, now],
    ["Closed", { status: "Resolved", resolvedAt: stamp }, undefined],
    ["Resolved", { status: "Closed", resolvedAt: stamp }, undefined],
    ["Open", { status: "Resolved", resolvedAt: stamp }, null],
    ["In Progress", { status: "Closed", resolvedAt: stamp }, null],
    ["Open", undefined, null],
    [undefined, { status: "Open", resolvedAt: null }, undefined],
    ["Weird", { status: "Open", resolvedAt: null }, undefined],
  ])("%s from %j -> %s", (next, previous, expected) => {
    expect(resolvedAtFor(next as string | undefined, previous as never, now)).toEqual(expected);
  });
});

describe("resolvedAt handling on write", () => {
  it("update: stamps resolvedAt when moved to Resolved", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", status: "Open", resolvedAt: null } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await ticketService.updateTicket("t1", { status: "Resolved" }, SCOPE);

    expect(vi.mocked(ticketRepository.update).mock.calls[0][1].resolvedAt).toBeInstanceOf(Date);
  });

  it("update: clears resolvedAt when reopened", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", status: "Resolved", resolvedAt: new Date() } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await ticketService.updateTicket("t1", { status: "Open" }, SCOPE);

    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).toHaveProperty("resolvedAt", null);
  });

  it("update: keeps the original date when Resolved becomes Closed", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", status: "Resolved", resolvedAt: new Date() } as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await ticketService.updateTicket("t1", { status: "Closed" }, SCOPE);

    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).not.toHaveProperty("resolvedAt");
  });

  it("update: ignores a client-sent resolvedAt / id / createdAt / updatedAt", async () => {
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await ticketService.updateTicket(
      "t1",
      { subject: "S", id: "evil", createdAt: new Date(), updatedAt: new Date(), resolvedAt: new Date() } as never,
      SCOPE,
    );

    const sent = vi.mocked(ticketRepository.update).mock.calls[0][1] as Record<string, unknown>;
    expect(sent).toEqual({ subject: "S" });
  });

  it("update: does not read the previous ticket when status, assignee and holiday are untouched", async () => {
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);
    await ticketService.updateTicket("t1", { priority: "High" }, SCOPE);
    expect(ticketRepository.findById).not.toHaveBeenCalled();
  });

  it("create: sets resolvedAt when created Resolved, not when Open", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);

    await ticketService.createTicket({ subject: "S", status: "Resolved" } as never, SCOPE);
    expect(vi.mocked(ticketRepository.create).mock.calls[0][0].resolvedAt).toBeInstanceOf(Date);

    await ticketService.createTicket({ subject: "S", status: "Open" } as never, SCOPE);
    expect(vi.mocked(ticketRepository.create).mock.calls[1][0]).not.toHaveProperty("resolvedAt");
  });
});

describe("holiday link validation (Q3)", () => {
  it("create: rejects a transaction that does not exist (400 Holiday not found)", async () => {
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue(undefined);
    await expect(
      ticketService.createTicket({ subject: "S", clientId: "c1", transactionId: "x1" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: "Holiday not found" });
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("create: rejects a transaction from another org (400 Holiday not found)", async () => {
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org2", clientId: "c1" });
    await expect(
      ticketService.createTicket({ subject: "S", clientId: "c1", transactionId: "x1" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: "Holiday not found" });
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("create: rejects a transaction of a different client", async () => {
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c2" });
    await expect(
      ticketService.createTicket({ subject: "S", clientId: "c1", transactionId: "x1" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: "Holiday belongs to a different client" });
  });

  it("create: a Build ticket with no client can never link a holiday", async () => {
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: null });
    await expect(
      ticketService.createTicket({ subject: "S", type: "Build", clientId: null, transactionId: "x1" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("create: accepts a holiday of the same org and client, and skips the lookup without a link", async () => {
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c1" });
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);

    await expect(
      ticketService.createTicket({ subject: "S", clientId: "c1", transactionId: "x1" } as never, SCOPE),
    ).resolves.toBeDefined();

    vi.mocked(ticketRepository.findHolidayLinkTarget).mockClear();
    await ticketService.createTicket({ subject: "S", clientId: "c1" } as never, SCOPE);
    expect(ticketRepository.findHolidayLinkTarget).not.toHaveBeenCalled();
  });

  it("update: validates against the stored org and client of the ticket", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", orgId: "org1", clientId: "c1" } as never);
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c1" });
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await expect(ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE)).resolves.toBeDefined();
  });

  it("update: rejects another org holiday and another client holiday", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", orgId: "org1", clientId: "c1" } as never);

    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org2", clientId: "c1" });
    await expect(ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });

    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c2" });
    await expect(ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.update).not.toHaveBeenCalled();
  });

  it("update: uses the resulting clientId when the client changes in the same PATCH", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", orgId: "org1", clientId: "c1" } as never);
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c2" });
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    await expect(ticketService.updateTicket("t1", { clientId: "c2", transactionId: "x1" }, SCOPE)).resolves.toBeDefined();
  });

  it("update: 404 when the ticket is out of scope; unlinking (null) needs no validation", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(undefined);
    await expect(ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE)).rejects.toMatchObject({ statusCode: 404 });

    vi.mocked(ticketRepository.findHolidayLinkTarget).mockClear();
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);
    await ticketService.updateTicket("t1", { transactionId: null }, SCOPE);
    expect(ticketRepository.findHolidayLinkTarget).not.toHaveBeenCalled();
  });
});

describe("holiday summaries", () => {
  const txn = (over: Partial<HolidayTransactionRow> = {}): HolidayTransactionRow => ({
    transactionId: "x1",
    orgId: "org1",
    clientId: "c1",
    status: "on_booking",
    bookingId: "b1",
    bookingTitle: "Maldives",
    bookingTravelDate: "2026-12-01",
    bookingNights: 7,
    haysRef: "H1",
    supplierRef: "S1",
    bookingOperatorName: "Op B",
    bookingOperatorLogoUrl: "http://b.png",
    enquiryId: "e1",
    enquiryTitle: "Enq",
    enquiryTravelDate: "2026-11-01",
    enquiryNights: 5,
    ...over,
  });
  const quoteRow: HolidayQuoteRow = {
    transactionId: "x1",
    quoteId: "q1",
    title: "Quote title",
    travelDate: "2026-12-02",
    nights: 10,
    operatorName: "Op Q",
    operatorLogoUrl: "http://q.png",
  };

  it("on_booking: booking facts with refs and operator", () => {
    expect(buildHolidaySummary(txn(), quoteRow, "org1")).toEqual({
      transactionId: "x1",
      kind: "booking",
      title: "Maldives",
      travelDate: "2026-12-01",
      nights: 7,
      operatorName: "Op B",
      operatorLogoUrl: "http://b.png",
      haysRef: "H1",
      supplierRef: "S1",
    });
  });

  it("on_quote: quote facts and operator, no refs", () => {
    const s = buildHolidaySummary(txn({ status: "on_quote" }), quoteRow, "org1");
    expect(s).toMatchObject({ kind: "quote", title: "Quote title", nights: 10, operatorName: "Op Q", haysRef: null, supplierRef: null });
  });

  it("on_enquiry: enquiry facts, no operator", () => {
    const s = buildHolidaySummary(txn({ status: "on_enquiry" }), undefined, "org1");
    expect(s).toMatchObject({ kind: "enquiry", title: "Enq", nights: 5, operatorName: null });
  });

  it("falls back to whichever facet exists when the stage facet is missing", () => {
    expect(buildHolidaySummary(txn({ status: "on_booking", bookingId: null }), quoteRow, "org1")).toMatchObject({ kind: "quote" });
    expect(buildHolidaySummary(txn({ status: "on_quote", bookingId: null }), undefined, "org1")).toMatchObject({ kind: "enquiry" });
    expect(buildHolidaySummary(txn({ status: null }), undefined, "org1")).toMatchObject({ kind: "booking" });
  });

  it("kind null with empty fields when nothing exists", () => {
    const s = buildHolidaySummary(txn({ bookingId: null, enquiryId: null }), undefined, "org1");
    expect(s).toMatchObject({ transactionId: "x1", kind: null, title: null, nights: null });
  });

  it("nights 0 becomes null", () => {
    expect(buildHolidaySummary(txn({ bookingNights: 0 }), undefined, "org1")?.nights).toBeNull();
  });

  it("null when the transaction belongs to another org", () => {
    expect(buildHolidaySummary(txn({ orgId: "org2" }), quoteRow, "org1")).toBeNull();
  });
});

describe("ticketService.listTickets", () => {
  const emptyFacets = {
    bookingId: null, bookingTitle: null, bookingTravelDate: null, bookingNights: null, haysRef: null, supplierRef: null,
    bookingOperatorName: null, bookingOperatorLogoUrl: null, enquiryId: null, enquiryTitle: null, enquiryTravelDate: null, enquiryNights: null,
  };

  it("makes no holiday query when no ticket has a transaction", async () => {
    vi.mocked(ticketRepository.findAll).mockResolvedValue([{ id: "t1", transactionId: null, orgId: "org1" }] as never);

    const rows = await ticketService.listTickets(SCOPE, "mine");

    expect(ticketRepository.findHolidaySummaries).not.toHaveBeenCalled();
    expect(rows).toEqual([{ id: "t1", transactionId: null, orgId: "org1", holiday: null }]);
  });

  it("looks up unique transaction ids once and attaches each summary", async () => {
    vi.mocked(ticketRepository.findAll).mockResolvedValue([
      { id: "t1", transactionId: "x1", orgId: "org1" },
      { id: "t2", transactionId: "x1", orgId: "org1" },
      { id: "t3", transactionId: "x2", orgId: "org1" },
      { id: "t4", transactionId: null, orgId: "org1" },
    ] as never);
    vi.mocked(ticketRepository.findHolidaySummaries).mockResolvedValue({
      transactions: [
        { transactionId: "x1", orgId: "org1", clientId: "c1", status: "on_quote", ...emptyFacets },
        { transactionId: "x2", orgId: "org9", clientId: "c1", status: "on_enquiry", ...emptyFacets, enquiryId: "e1", enquiryTitle: "E" },
      ],
      quotes: [{ transactionId: "x1", quoteId: "q1", title: "Q", travelDate: "2026-12-02", nights: 3, operatorName: "Op", operatorLogoUrl: null }],
    });

    const rows = await ticketService.listTickets(SCOPE, "mine");

    expect(ticketRepository.findHolidaySummaries).toHaveBeenCalledWith(["x1", "x2"]);
    expect(rows[0].holiday).toMatchObject({ kind: "quote", title: "Q", operatorName: "Op" });
    expect(rows[1].holiday).toMatchObject({ kind: "quote" });
    expect(rows[2].holiday).toBeNull(); // another org transaction is never exposed
    expect(rows[3].holiday).toBeNull();
  });

  it("still rejects scope=all for non-admins before querying", async () => {
    await expect(ticketService.listTickets(SCOPE, "all")).rejects.toMatchObject({ statusCode: 403 });
    expect(ticketRepository.findAll).not.toHaveBeenCalled();
  });
});

describe("createTicket body hardening", () => {
  it("strips server-owned fields and forces userId to the caller", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);

    await ticketService.createTicket(
      {
        subject: "S",
        userId: "someone-else",
        id: "evil",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: new Date(),
        orgId: "org2",
        branchId: "b9",
      } as never,
      SCOPE,
    );

    const sent = vi.mocked(ticketRepository.create).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sent).toEqual({ subject: "S", userId: "u1" });
  });

  it("keeps the body userId only when the scope has none (system scope)", async () => {
    vi.mocked(ticketRepository.create).mockResolvedValue({ id: "t1", subject: "S" } as never);
    await ticketService.createTicket({ subject: "S", userId: "owner" } as never, { ...SCOPE, userId: null, orgRole: "org_admin", orgRoles: ["org_admin"] });
    expect(vi.mocked(ticketRepository.create).mock.calls[0][0]).toMatchObject({ userId: "owner" });
  });
});

describe("client must belong to the ticket org", () => {
  it("create: 400 Client not found for a foreign or missing client", async () => {
    vi.mocked(ticketRepository.findClientRef).mockResolvedValue({ id: "c1", orgId: "org2" });
    await expect(ticketService.createTicket({ subject: "S", clientId: "c1" } as never, SCOPE)).rejects.toMatchObject({
      statusCode: 400,
      message: "Client not found",
    });
    vi.mocked(ticketRepository.findClientRef).mockResolvedValue(undefined);
    await expect(ticketService.createTicket({ subject: "S", clientId: "c1" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("update: 400 for a foreign client, checked against the stored ticket org", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", orgId: "org1", clientId: "c1" } as never);
    vi.mocked(ticketRepository.findClientRef).mockResolvedValue({ id: "c9", orgId: "org2" });
    await expect(ticketService.updateTicket("t1", { clientId: "c9" }, SCOPE)).rejects.toMatchObject({ statusCode: 400, message: "Client not found" });
    expect(ticketRepository.update).not.toHaveBeenCalled();
  });

  it("update: 404 when the ticket is out of scope", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(undefined);
    await expect(ticketService.updateTicket("t1", { clientId: "c2" }, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("holiday link follows the client on PATCH", () => {
  const prev = { id: "t1", orgId: "org1", clientId: "c1", transactionId: "x1" };

  it("clears the link when the client changes and no transactionId is sent", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(prev as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);
    await ticketService.updateTicket("t1", { clientId: "c2" }, SCOPE);
    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).toMatchObject({ clientId: "c2", transactionId: null });
  });

  it("clears the link when the client is removed", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(prev as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);
    await ticketService.updateTicket("t1", { clientId: null }, SCOPE);
    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).toMatchObject({ clientId: null, transactionId: null });
  });

  it("keeps the link when the client is unchanged", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(prev as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);
    await ticketService.updateTicket("t1", { clientId: "c1" }, SCOPE);
    expect(vi.mocked(ticketRepository.update).mock.calls[0][1]).not.toHaveProperty("transactionId");
  });

  it("skips re-validation when the same transactionId is re-sent with the same client", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(prev as never);
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);
    await ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE);
    expect(ticketRepository.findHolidayLinkTarget).not.toHaveBeenCalled();
  });

  it("re-validates the same transactionId when the client changes", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(prev as never);
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c1" });
    await expect(ticketService.updateTicket("t1", { clientId: "c2", transactionId: "x1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("holiday link must be visible to the caller (transaction scope)", () => {
  it("create: 400 when the transaction is outside the caller pipeline scope (e.g. agent from another branch)", async () => {
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c1" });
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue(undefined);

    await expect(
      ticketService.createTicket({ subject: "S", clientId: "c1", transactionId: "x1" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: "Holiday not found" });
    expect(transactionRepository.findByIdScopedForWrite).toHaveBeenCalledWith("x1", SCOPE);
    expect(ticketRepository.create).not.toHaveBeenCalled();
  });

  it("update: 400 when not visible; passes when visible", async () => {
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", orgId: "org1", clientId: "c1" } as never);
    vi.mocked(ticketRepository.findHolidayLinkTarget).mockResolvedValue({ id: "x1", orgId: "org1", clientId: "c1" });
    vi.mocked(ticketRepository.update).mockResolvedValue({ id: "t1", orgId: "org1" } as never);

    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue(undefined);
    await expect(ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });

    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "x1" } as never);
    await expect(ticketService.updateTicket("t1", { transactionId: "x1" }, SCOPE)).resolves.toBeDefined();
  });
});
