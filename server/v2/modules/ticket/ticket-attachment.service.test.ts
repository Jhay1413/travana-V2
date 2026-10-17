import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/s3", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/file"),
}));

vi.mock("./ticket-attachment.repository", () => ({
  ticketAttachmentRepository: {
    findById: vi.fn(),
    findByTicketId: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("./ticket-reply.repository", () => ({
  ticketReplyRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("./ticket.repository", () => ({
  ticketRepository: {
    findByIdScoped: vi.fn(),
  },
}));

import { ticketAttachmentService, canDeleteAttachment } from "./ticket-attachment.service";
import { ticketAttachmentRepository } from "./ticket-attachment.repository";
import { ticketReplyRepository } from "./ticket-reply.repository";
import { ticketRepository } from "./ticket.repository";
import { s3Client } from "../../config/s3";
import type { Scope } from "../../utils/scope";

const TRUSTED_SCOPE = { orgId: null } as never;
const FILE = { buffer: Buffer.from("x"), originalName: "a.png", mimeType: "image/png", size: 1 };

const AGENT: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};
const asRole = (orgRole: Scope["orgRole"]): Scope => ({ ...AGENT, orgRole, orgRoles: [orgRole] });

const TICKET = { id: "t1", userId: "raiser1", assignedTo: "u1", subject: "S" };
const att = (over: Record<string, unknown> = {}) =>
  ({
    id: "att1",
    ticketId: "t1",
    replyId: null,
    filename: "ticket-attachments/1-2.png",
    originalName: "a.png",
    mimeType: "image/png",
    size: 1,
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue(TICKET as never);
  vi.mocked(ticketAttachmentRepository.create).mockImplementation(async (row) => ({ id: "att1", createdAt: new Date(), ...row }) as never);
});

describe("ticketAttachmentService.uploadAndCreate — reply attachments", () => {
  it("stores the reply id when the reply belongs to the ticket", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({ id: "r1", ticketId: "t1" } as never);

    await ticketAttachmentService.uploadAndCreate("t1", { ...FILE, replyId: "r1" }, TRUSTED_SCOPE);

    expect(ticketAttachmentRepository.create).toHaveBeenCalledWith(expect.objectContaining({ ticketId: "t1", replyId: "r1" }));
  });

  it("rejects a reply from a different ticket", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({ id: "r1", ticketId: "t2" } as never);

    await expect(
      ticketAttachmentService.uploadAndCreate("t1", { ...FILE, replyId: "r1" }, TRUSTED_SCOPE),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(ticketAttachmentRepository.create).not.toHaveBeenCalled();
  });

  it("stores a null reply id for ticket-level attachments", async () => {
    await ticketAttachmentService.uploadAndCreate("t1", FILE, TRUSTED_SCOPE);

    expect(ticketReplyRepository.findById).not.toHaveBeenCalled();
    expect(ticketAttachmentRepository.create).toHaveBeenCalledWith(expect.objectContaining({ ticketId: "t1", replyId: null }));
  });

  it("works for the system scope the SendSeven bot uses (org_admin)", async () => {
    const system = asRole("org_admin");
    await expect(ticketAttachmentService.uploadAndCreate("t1", FILE, system)).resolves.toMatchObject({ ticketId: "t1" });
    expect(ticketRepository.findByIdScoped).toHaveBeenCalledWith("t1", system);
  });
});

describe("ticketAttachmentService — ticket scope is enforced", () => {
  beforeEach(() => {
    vi.mocked(ticketRepository.findByIdScoped).mockResolvedValue(undefined);
  });

  it("list: 404 when the ticket is outside scope", async () => {
    await expect(ticketAttachmentService.listByTicketId("t1", AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(ticketAttachmentRepository.findByTicketId).not.toHaveBeenCalled();
  });

  it("upload: 404 before anything is sent to S3 or saved", async () => {
    await expect(ticketAttachmentService.uploadAndCreate("t1", FILE, AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(ticketAttachmentRepository.create).not.toHaveBeenCalled();
  });

  it("createAttachment: 404 when the ticket is outside scope", async () => {
    await expect(
      ticketAttachmentService.createAttachment({ ticketId: "t1" } as never, AGENT),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(ticketAttachmentRepository.create).not.toHaveBeenCalled();
  });

  it("download: 404 before a URL is presigned", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    await expect(ticketAttachmentService.getDownloadTarget("att1", AGENT)).rejects.toMatchObject({
      statusCode: 404,
      message: "Attachment not found",
    });
  });

  it("get: 404 when the attachment's ticket is outside scope, or the attachment is missing", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    await expect(ticketAttachmentService.getAttachmentById("att1", AGENT)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(undefined);
    await expect(ticketAttachmentService.getAttachmentById("att1", AGENT)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("delete: 404 and nothing removed when out of scope", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    await expect(ticketAttachmentService.deleteAttachment("att1", AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(ticketAttachmentRepository.remove).not.toHaveBeenCalled();
  });
});

describe("ticketAttachmentService.deleteAttachment", () => {
  it("lets the ticket raiser delete a ticket-level file (S3 object and row)", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    const raiser = { ...AGENT, userId: "raiser1" };

    await ticketAttachmentService.deleteAttachment("att1", raiser);

    expect(s3Client.send).toHaveBeenCalledTimes(1);
    expect(ticketAttachmentRepository.remove).toHaveBeenCalledWith("att1");
  });

  it("403 for another in-scope agent, and S3 is not touched", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());

    await expect(ticketAttachmentService.deleteAttachment("att1", AGENT)).rejects.toMatchObject({ statusCode: 403 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(ticketAttachmentRepository.remove).not.toHaveBeenCalled();
  });

  it("lets a reply author delete their reply file, but not the ticket raiser", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att({ replyId: "r1" }));
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({ id: "r1", userId: "u1" } as never);

    await expect(ticketAttachmentService.deleteAttachment("att1", AGENT)).resolves.toBeDefined();

    vi.mocked(ticketAttachmentRepository.remove).mockClear();
    await expect(
      ticketAttachmentService.deleteAttachment("att1", { ...AGENT, userId: "raiser1" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(ticketAttachmentRepository.remove).not.toHaveBeenCalled();
  });

  it("lets an org_admin delete anyone's file within scope", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    await expect(ticketAttachmentService.deleteAttachment("att1", asRole("org_admin"))).resolves.toBeDefined();
  });
});

describe("canDeleteAttachment", () => {
  const ticket = { userId: "raiser1" };
  const ticketFile = { replyId: null };
  const replyFile = { replyId: "r1" };

  it("trusted internal callers may always delete", () => {
    expect(canDeleteAttachment({ attachment: ticketFile, ticket, replyAuthorId: null, scope: TRUSTED_SCOPE })).toBe(true);
  });

  it.each(["branch_manager", "org_admin", "platform_admin"] as const)("%s may delete any in-scope file", (role) => {
    const scope = asRole(role);
    expect(canDeleteAttachment({ attachment: ticketFile, ticket, replyAuthorId: null, scope })).toBe(true);
    expect(canDeleteAttachment({ attachment: replyFile, ticket, replyAuthorId: "someone", scope })).toBe(true);
  });

  it("ticket-level file: only the ticket raiser (agent / homeworker)", () => {
    for (const role of ["agent", "homeworker"] as const) {
      const base = asRole(role);
      expect(canDeleteAttachment({ attachment: ticketFile, ticket, replyAuthorId: null, scope: { ...base, userId: "raiser1" } })).toBe(true);
      expect(canDeleteAttachment({ attachment: ticketFile, ticket, replyAuthorId: null, scope: { ...base, userId: "other" } })).toBe(false);
    }
  });

  it("reply file: only the reply author, not the ticket raiser", () => {
    expect(canDeleteAttachment({ attachment: replyFile, ticket, replyAuthorId: "u1", scope: AGENT })).toBe(true);
    expect(canDeleteAttachment({ attachment: replyFile, ticket, replyAuthorId: "x", scope: { ...AGENT, userId: "raiser1" } })).toBe(false);
  });

  it("reply file whose reply is gone: not deletable by a plain agent", () => {
    expect(canDeleteAttachment({ attachment: replyFile, ticket, replyAuthorId: null, scope: AGENT })).toBe(false);
  });

  it("fails closed without a user id", () => {
    expect(canDeleteAttachment({ attachment: ticketFile, ticket, replyAuthorId: null, scope: { ...AGENT, userId: null } })).toBe(false);
  });
});

describe("reply attachments belong to the reply author", () => {
  it("403 when attaching to someone else's reply (nothing sent to S3)", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({ id: "r1", ticketId: "t1", userId: "other" } as never);
    await expect(
      ticketAttachmentService.uploadAndCreate("t1", { ...FILE, replyId: "r1" }, AGENT),
    ).rejects.toMatchObject({ statusCode: 403, message: "You can only attach files to your own replies" });
    expect(s3Client.send).not.toHaveBeenCalled();
  });

  it("allows the reply author", async () => {
    vi.mocked(ticketReplyRepository.findById).mockResolvedValue({ id: "r1", ticketId: "t1", userId: "u1" } as never);
    await expect(ticketAttachmentService.uploadAndCreate("t1", { ...FILE, replyId: "r1" }, AGENT)).resolves.toBeDefined();
  });
});

describe("attachment storage hardening", () => {
  it("download: a local filename escaping uploads/ is a 404", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att({ filename: "../../etc/passwd" }));
    await expect(ticketAttachmentService.getDownloadTarget("att1", AGENT)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("delete: removes the row first and still succeeds when S3 cleanup fails", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    vi.mocked(s3Client.send).mockRejectedValueOnce(new Error("s3 down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(ticketAttachmentService.deleteAttachment("att1", asRole("org_admin"))).resolves.toBeDefined();

    expect(ticketAttachmentRepository.remove).toHaveBeenCalledWith("att1");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("delete: a failing row delete never touches S3", async () => {
    vi.mocked(ticketAttachmentRepository.findById).mockResolvedValue(att());
    vi.mocked(ticketAttachmentRepository.remove).mockRejectedValueOnce(new Error("db"));
    await expect(ticketAttachmentService.deleteAttachment("att1", asRole("org_admin"))).rejects.toThrow("db");
    expect(s3Client.send).not.toHaveBeenCalled();
  });
});
