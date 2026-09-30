import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/s3", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example/signed"),
}));

vi.mock("./note-attachment.repository", () => ({
  noteAttachmentRepository: {
    findById: vi.fn(),
    findByNoteId: vi.fn(),
    findByTransactionId: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("./note.repository", () => ({
  noteRepository: {
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    transactionBelongsToOrg: vi.fn(),
  },
}));

import { noteAttachmentService } from "./note-attachment.service";
import { noteAttachmentRepository } from "./note-attachment.repository";
import { noteRepository } from "./note.repository";
import { s3Client } from "../../config/s3";

const TRUSTED_SCOPE = { orgId: null } as never;
const ORG_SCOPE = { orgId: "org1", orgRole: "agent" } as never;
const ADMIN_SCOPE = { orgId: "org1", orgRole: "platform_admin" } as never;
const FILE = { buffer: Buffer.from("x"), originalName: "a.png", mimeType: "image/png", size: 1 };
const ATTACHMENT = { id: "att1", noteId: "n1", filename: "note-attachments/k.png", originalName: "a.png", mimeType: "image/png", size: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(noteAttachmentRepository.create).mockImplementation(
    async (row) => ({ id: "att1", createdAt: new Date(), ...row }) as never,
  );
});

describe("noteAttachmentService.uploadMany", () => {
  it("uploads every file to S3 and records a row for each", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1" } as never);

    const result = await noteAttachmentService.uploadMany("n1", [FILE, FILE], ORG_SCOPE);

    expect(result).toHaveLength(2);
    expect(s3Client.send).toHaveBeenCalledTimes(2);
    expect(noteAttachmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ noteId: "n1", originalName: "a.png", mimeType: "image/png", size: 1 }),
    );
    const row = vi.mocked(noteAttachmentRepository.create).mock.calls[0][0];
    expect(row.filename.startsWith("note-attachments/")).toBe(true);
  });

  it("rejects an empty upload", async () => {
    await expect(noteAttachmentService.uploadMany("n1", [], TRUSTED_SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a note in another org before touching S3", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "other" } as never);

    await expect(noteAttachmentService.uploadMany("n1", [FILE], ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(noteAttachmentRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a missing note for a trusted caller", async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(undefined);

    await expect(noteAttachmentService.uploadMany("n1", [FILE], TRUSTED_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
  });

  it("removes the S3 object when recording the row fails", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1" } as never);
    vi.mocked(noteAttachmentRepository.create).mockRejectedValue(new Error("db down"));

    await expect(noteAttachmentService.uploadMany("n1", [FILE], ORG_SCOPE)).rejects.toThrow("db down");
    // one PutObject + one compensating DeleteObject
    expect(s3Client.send).toHaveBeenCalledTimes(2);
  });
});

describe("noteAttachmentService listing", () => {
  it("lists a note's attachments when the note is in scope", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1" } as never);
    vi.mocked(noteAttachmentRepository.findByNoteId).mockResolvedValue([ATTACHMENT] as never);

    await expect(noteAttachmentService.listByNoteId("n1", ORG_SCOPE)).resolves.toEqual([ATTACHMENT]);
  });

  it("does not list attachments of a note in another org", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "other" } as never);

    await expect(noteAttachmentService.listByNoteId("n1", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(noteAttachmentRepository.findByNoteId).not.toHaveBeenCalled();
  });

  it("does not list a deal's attachments when the deal is in another org", async () => {
    vi.mocked(noteRepository.transactionBelongsToOrg).mockResolvedValue(false);

    await expect(noteAttachmentService.listByTransactionId("t1", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(noteAttachmentRepository.findByTransactionId).not.toHaveBeenCalled();
  });

  it("lists a deal's attachments when the deal is in scope", async () => {
    vi.mocked(noteRepository.transactionBelongsToOrg).mockResolvedValue(true);
    vi.mocked(noteAttachmentRepository.findByTransactionId).mockResolvedValue([ATTACHMENT] as never);

    await expect(noteAttachmentService.listByTransactionId("t1", ORG_SCOPE)).resolves.toEqual([ATTACHMENT]);
  });

  it("skips the org check for platform admins", async () => {
    vi.mocked(noteAttachmentRepository.findByTransactionId).mockResolvedValue([]);

    await noteAttachmentService.listByTransactionId("t1", ADMIN_SCOPE);
    expect(noteRepository.transactionBelongsToOrg).not.toHaveBeenCalled();
  });
});

describe("noteAttachmentService download and delete", () => {
  it("hides an attachment whose note is out of scope (download)", async () => {
    vi.mocked(noteAttachmentRepository.findById).mockResolvedValue(ATTACHMENT as never);
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "other" } as never);

    await expect(noteAttachmentService.getDownloadTarget("att1", ORG_SCOPE)).rejects.toMatchObject({
      statusCode: 404,
      message: "Attachment not found",
    });
  });

  it("returns a signed S3 url for an in-scope attachment", async () => {
    vi.mocked(noteAttachmentRepository.findById).mockResolvedValue(ATTACHMENT as never);
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1" } as never);

    await expect(noteAttachmentService.getDownloadTarget("att1", ORG_SCOPE, { inline: true })).resolves.toEqual({
      kind: "s3",
      url: "https://s3.example/signed",
    });
  });

  it("404s on an unknown attachment", async () => {
    vi.mocked(noteAttachmentRepository.findById).mockResolvedValue(undefined);

    await expect(noteAttachmentService.getDownloadTarget("nope", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses to delete an out-of-scope attachment", async () => {
    vi.mocked(noteAttachmentRepository.findById).mockResolvedValue(ATTACHMENT as never);
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "other" } as never);

    await expect(noteAttachmentService.deleteAttachment("att1", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(noteAttachmentRepository.remove).not.toHaveBeenCalled();
  });

  it("deletes the S3 object and the row for an in-scope attachment", async () => {
    vi.mocked(noteAttachmentRepository.findById).mockResolvedValue(ATTACHMENT as never);
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1" } as never);

    await noteAttachmentService.deleteAttachment("att1", ORG_SCOPE);

    expect(s3Client.send).toHaveBeenCalledTimes(1);
    expect(noteAttachmentRepository.remove).toHaveBeenCalledWith("att1");
  });
});
