import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./ticket-reply.repository", () => ({
  ticketReplyRepository: {
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    ticketBelongsToOrg: vi.fn(),
    findByTicketId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toggleLike: vi.fn(),
  },
}));

vi.mock("./ticket.repository", () => ({
  ticketRepository: {
    findById: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ticketReplyService.updateReply", () => {
  it("throws 403 when the acting user is not the author", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "r1",
      ticketId: "t1",
      userId: "author1",
      parentReplyId: null,
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      ticketReplyService.updateReply("r1", "new content", "other-user", TRUSTED_SCOPE)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(ticketReplyRepository.update).not.toHaveBeenCalled();
  });
});

describe("ticketReplyService.deleteReply", () => {
  it("allows a platform_admin to delete any reply in their org", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "r1",
      ticketId: "t1",
      userId: "author1",
      parentReplyId: null,
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

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
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "r1",
      ticketId: "t1",
      userId: "author1",
      parentReplyId: null,
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(ticketReplyService.deleteReply("r1", "other-user", TRUSTED_SCOPE)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(ticketReplyRepository.remove).not.toHaveBeenCalled();
  });
});

describe("ticketReplyService.createReply", () => {
  it("throws 400 when parentReplyId belongs to a different ticket", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "p1",
      ticketId: "t2",
      userId: "author2",
      parentReplyId: null,
      content: "parent",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      ticketReplyService.createReply(
        { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never,
        TRUSTED_SCOPE
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(ticketReplyRepository.create).not.toHaveBeenCalled();
  });

  it("notifies the parent reply's author when they differ from the replier and ticket owner", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "p1",
      ticketId: "t1",
      userId: "author2",
      parentReplyId: null,
      content: "parent",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(ticketReplyRepository.create).mockResolvedValue({
      id: "r2",
      ticketId: "t1",
      userId: "u1",
      parentReplyId: "p1",
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({
      id: "t1",
      userId: "owner1",
      subject: "Subject",
    } as never);

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never,
      TRUSTED_SCOPE
    );

    expect(notificationRepository.create).toHaveBeenCalledTimes(2);
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1" }));
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "author2" }));
  });

  it("does not notify the parent author when they are the replier", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "p1",
      ticketId: "t1",
      userId: "u1",
      parentReplyId: null,
      content: "parent",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(ticketReplyRepository.create).mockResolvedValue({
      id: "r2",
      ticketId: "t1",
      userId: "u1",
      parentReplyId: "p1",
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({
      id: "t1",
      userId: "owner1",
      subject: "Subject",
    } as never);

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "p1" } as never,
      TRUSTED_SCOPE
    );

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner1" }));
  });
});

describe("ticketReplyService.toggleLike", () => {
  it("returns the repository result", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      id: "r1",
      ticketId: "t1",
      userId: "author1",
      parentReplyId: null,
      content: "hi",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(ticketReplyRepository.toggleLike).mockResolvedValue({ liked: true, likeCount: 3 });

    await expect(ticketReplyService.toggleLike("r1", "u1", TRUSTED_SCOPE)).resolves.toEqual({
      liked: true,
      likeCount: 3,
    });
    expect(ticketReplyRepository.toggleLike).toHaveBeenCalledWith("r1", "u1");
  });
});

describe("ticketReplyService — content and threading rules", () => {
  const baseReply = {
    id: "r2",
    ticketId: "t1",
    userId: "u1",
    parentReplyId: null,
    content: "hi",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("strips script from reply HTML before saving", async () => {
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(baseReply as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue(undefined as never);

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: '<p>hello</p><img src=x onerror="alert(1)"><script>x()</script>' } as never,
      TRUSTED_SCOPE
    );

    const saved = vi.mocked(ticketReplyRepository.create).mock.calls[0][0];
    expect(saved.content).toBe("<p>hello</p>");
  });

  it("rejects content that is empty once sanitised", async () => {
    await expect(
      ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "<script>x()</script>" } as never, TRUSTED_SCOPE)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketReplyRepository.create).not.toHaveBeenCalled();
  });

  it("re-points a reply to a child onto the child's top-level parent", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({
      ...baseReply,
      id: "child1",
      userId: "author2",
      parentReplyId: "top1",
    } as never);
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(baseReply as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue(undefined as never);

    await ticketReplyService.createReply(
      { ticketId: "t1", userId: "u1", content: "hi", parentReplyId: "child1" } as never,
      TRUSTED_SCOPE
    );

    const saved = vi.mocked(ticketReplyRepository.create).mock.calls[0][0];
    expect(saved.parentReplyId).toBe("top1");
    // The person actually replied to is still the one notified.
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "author2" }));
  });

  it("still returns the saved reply when a notification write fails", async () => {
    vi.mocked(ticketReplyRepository.create).mockResolvedValue(baseReply as never);
    vi.mocked(ticketRepository.findById).mockResolvedValue({ id: "t1", userId: "owner1", subject: "S" } as never);
    vi.mocked(notificationRepository.create).mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      ticketReplyService.createReply({ ticketId: "t1", userId: "u1", content: "hi" } as never, TRUSTED_SCOPE)
    ).resolves.toMatchObject({ id: "r2" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sanitises edited content too", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue(baseReply as never);
    vi.mocked(ticketReplyRepository.update).mockResolvedValue(baseReply as never);

    await ticketReplyService.updateReply("r2", '<p>ok</p><a href="javascript:alert(1)">x</a>', "u1", TRUSTED_SCOPE);

    expect(ticketReplyRepository.update).toHaveBeenCalledWith("r2", expect.not.stringContaining("javascript:"));
  });
});
