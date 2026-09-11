import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/s3", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));

vi.mock("./ticket-attachment.repository", () => ({
  ticketAttachmentRepository: {
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    ticketBelongsToOrg: vi.fn(),
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

import { ticketAttachmentService } from "./ticket-attachment.service";
import { ticketAttachmentRepository } from "./ticket-attachment.repository";
import { ticketReplyRepository } from "./ticket-reply.repository";

const TRUSTED_SCOPE = { orgId: null } as never;
const FILE = { buffer: Buffer.from("x"), originalName: "a.png", mimeType: "image/png", size: 1 };

beforeEach(() => {
  vi.clearAllMocks();
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
});
