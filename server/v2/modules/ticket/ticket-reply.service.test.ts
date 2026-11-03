import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./ticket-reply.repository", () => ({
  ticketReplyRepository: {
    findById: vi.fn(),
    findByTicketId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleLike: vi.fn(),
  },
}));

vi.mock("./ticket.repository", () => ({
  ticketRepository: {
    findByIdScoped: vi.fn(),
  },
}));

vi.mock("../notification/notification.repository", () => ({
  notificationRepository: {
    create: vi.fn(),
  },
}));

import { ticketReplyService } from "./ticket-reply.service";
import { ticketReplyRepository } from "./ticket-reply.repository";
import { ticketRepository } from "./ticket.repository";
import { notificationRepository } from "../notification/notification.repository";

const TRUSTED_SCOPE = { orgId: null } as never;
const AGENT_SCOPE = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
} as never;

const TICKET = { id: "t1", userId: "owner1", assignedTo: null, subject: "Subject" };

const reply = (over: Record<string, unknown> = {}) =>
  ({
    id: "r1",
    ticketId: "t1",
    userId: "author1",
    parentReplyId: null,
    content: "hi",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue(TICKET as never);
  vi.mocked(notificationRepository.create).mockResolvedValue(undefined as never);
});

describe("ticketReplyService — ticket scope is enforced on every operation", () => {
  it("list: 404 when the ticket is outside the caller's scope", async () => {
    vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue(undefined);
    await expect(ticketReplyService.listByTicketId("t1", AGENT_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(ticketReplyRepository.findByTicketId).not.toHaveBeenCalled();
  });

  it("list: forwards the caller's scope to the ticket gate and returns the replies", async () => {
    vi.mocked(ticketReplyRepository.findByTicketId).mockResolvedValue([] as never);
    await ticketReplyService.listByTicketId("t1", AGENT_SCOPE);
    expect(ticketRepository.findByIdScoped).toHaveBeenCalledWith("t1", AGENT_SCOPE);
    expect(ticketReplyRepository.findByTicketId).toHaveBeenCalledWith("t1", "u1");
  });

  it("create: 404 when the ticket is outside the caller's scope (nothing written)", async () => {
    vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue(undefined);
    await expect(
      ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi" } as never, AGENT_SCOPE),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(ticketReplyRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ["update", (s: never) => ticketReplyService.updateReply("r1", "new", "author1", s)],
    ["delete", (s: never) => ticketReplyService.deleteReply("r1", "author1", s)],
    ["like", (s: never) => ticketReplyService.toggleLike("r1", "u1", s)],
  ])("%s: 404 'Reply not found' when the reply's ticket is outside scope", async (_name, run) => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply());
    vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue(undefined);

    await expect(run(AGENT_SCOPE)).rejects.toMatchObject({ statusCode: 404, message: "Reply not found" });
    expect(ticketReplyRepository.update).not.toHaveBeenCalled();
    expect(ticketReplyRepository.remove).not.toHaveBeenCalled();
    expect(ticketReplyRepository.toggleLike).not.toHaveBeenCalled();
    expect(ticketRepository.findByIdScoped).toHaveBeenCalledWith("t1", AGENT_SCOPE);
  });

  it("404 when the reply does not exist", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(undefined);
    await expect(ticketReplyService.toggleLike("r1", "u1", AGENT_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a trusted scope is forwarded to the gate unchanged", async () => {
    vi.mocked(ticketReplyRepository.findByTicketId).mockResolvedValue([] as never);
    await ticketReplyService.listByTicketId("t1", TRUSTED_SCOPE);
    expect(ticketRepository.findByIdScoped).toHaveBeenCalledWith("t1", TRUSTED_SCOPE);
  });
});

describe("ticketReplyService.updateReply", () => {
  it("throws 403 when the acting user is not the author", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply());

    await expect(
      ticketReplyService.updateReply("r1", "new content", "other-user", TRUSTED_SCOPE),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(ticketReplyRepository.update).not.toHaveBeenCalled();
  });
});

describe("ticketReplyService.deleteReply", () => {
  it("allows a platform_admin to delete any reply", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply());

    const adminScope = {
      orgId: null,
      orgRole: "platform_admin",
      orgRoles: ["platform_admin"],
      branchId: null,
      userId: "admin1",
    } as never;

    await expect(ticketReplyService.deleteReply("r1", "admin1", adminScope)).resolves.toBeUndefined();
    expect(ticketReplyRepository.remove).toHaveBeenCalledWith("r1");
  });

  it("throws 403 when a non-author, non-admin tries to delete", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply());

    await expect(ticketReplyService.deleteReply("r1", "other-user", TRUSTED_SCOPE)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(ticketReplyRepository.remove).not.toHaveBeenCalled();
  });

  it("lets the author delete their own reply", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply());
    await expect(ticketReplyService.deleteReply("r1", "author1", AGENT_SCOPE)).resolves.toBeUndefined();
    expect(ticketReplyRepository.remove).toHaveBeenCalledWith("r1");
  });
});

describe("ticketReplyService.createReply", () => {
  it("throws 400 when parentReplyId belongs to a different ticket", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply({ id: "p1", ticketId: "t2", userId: "author2" }));

    await expect(
      ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never, TRUSTED_SCOPE),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(ticketReplyRepository.create).not.toHaveBeenCalled();
  });

  it("notifies the parent reply's author when they differ from the replier and ticket owner", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply({ id: "p1", userId: "author2" }));
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(reply({ id: "r2", userId: "u1", parentReplyId: "p1" }));

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never,
      TRUSTED_SCOPE,
    );

    expect(notificationRepository.create).toHaveBeenCalledTimes(2);
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1" }));
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "author2" }));
  });

  it("does not notify the parent author when they are the replier", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply({ id: "p1", userId: "u1" }));
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(reply({ id: "r2", userId: "u1", parentReplyId: "p1" }));

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never,
      TRUSTED_SCOPE,
    );

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1" }));
  });

  describe("assignee notification", () => {
    beforeEach(() => {
      vi.mocked(ticketReplyRepository.create).mockResolvedValue(reply({ id: "r2", userId: "u1" }));
    });

    it("tells the assignee too, with the same title as the creator", async () => {
      vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue({ ...TICKET, assignedTo: "assignee1" } as never);

      await ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi" } as never, AGENT_SCOPE);

      expect(notificationRepository.create).toHaveBeenCalledTimes(2);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "assignee1", title: "New reply on your ticket", link: "/tickets/t1" }),
      );
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "owner1", title: "New reply on your ticket" }),
      );
    });

    it("notifies once when the assignee is the creator", async () => {
      vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue({ ...TICKET, assignedTo: "owner1" } as never);

      await ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi" } as never, AGENT_SCOPE);

      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1" }));
    });

    it("never notifies the replier, even as assignee", async () => {
      vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue({ ...TICKET, assignedTo: "u1" } as never);

      await ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi" } as never, AGENT_SCOPE);

      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1" }));
    });

    it("does not double-notify when the parent author is the assignee", async () => {
      vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue({ ...TICKET, assignedTo: "author2" } as never);
      vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply({ id: "p1", userId: "author2" }));

      await ticketReplyService.createReply(
        { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never,
        AGENT_SCOPE,
      );

      const forAuthor2 = vi.mocked(notificationRepository.create).mock.calls.filter(([n]) => n.userId === "author2");
      expect(forAuthor2).toHaveLength(1);
      expect(notificationRepository.create).toHaveBeenCalledTimes(2);
    });
  });
});

describe("ticketReplyService.toggleLike", () => {
  it("returns the repository result", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(reply());
    vi.mocked(ticketReplyRepository.toggleLike).mockResolvedValue({ liked: true, likeCount: 3 });

    await expect(ticketReplyService.toggleLike("r1", "u1", TRUSTED_SCOPE)).resolves.toEqual({
      liked: true,
      likeCount: 3,
    });
    expect(ticketReplyRepository.toggleLike).toHaveBeenCalledWith("r1", "u1");
  });
});

describe("ticketReplyService — content and threading rules", () => {
  const baseReply = reply({ id: "r2", userId: "u1" });

  it("strips script from reply HTML before saving", async () => {
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(baseReply);

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: '<p>hello</p><img src=x onerror="alert(1)"><script>x()</script>' } as never,
      TRUSTED_SCOPE,
    );

    const saved = vi.mocked(ticketReplyRepository.create).mock.calls[0][0];
    expect(saved.content).toBe("<p>hello</p>");
  });

  it("rejects content that is empty once sanitised", async () => {
    await expect(
      ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "<script>x()</script>" } as never, TRUSTED_SCOPE),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketReplyRepository.create).not.toHaveBeenCalled();
  });

  it("re-points a reply to a child onto the child's top-level parent", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(
      reply({ id: "child1", userId: "author2", parentReplyId: "top1" }),
    );
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(baseReply);

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "child1" } as never,
      TRUSTED_SCOPE,
    );

    const saved = vi.mocked(ticketReplyRepository.create).mock.calls[0][0];
    expect(saved.parentReplyId).toBe("top1");
    // The person actually replied to is still the one notified.
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "author2" }));
  });

  it("still returns the saved reply when a notification write fails", async () => {
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(baseReply);
    vi.mocked(notificationRepository.create).mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi" } as never, TRUSTED_SCOPE),
    ).resolves.toMatchObject({ id: "r2" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sanitises edited content too", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(baseReply);
    vi.mocked(ticketReplyRepository.update).mockResolvedValue(baseReply);

    await ticketReplyService.updateReply("r2", '<p>ok</p><a href="javascript:alert(1)">x</a>', "u1", TRUSTED_SCOPE);

    expect(ticketReplyRepository.update).toHaveBeenCalledWith("r2", expect.not.stringContaining("javascript:"));
  });
});
