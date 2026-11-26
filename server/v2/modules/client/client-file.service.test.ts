import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/s3", () => ({ s3Client: { send: vi.fn().mockResolvedValue({}) }, S3_BUCKET: "bucket" }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn().mockResolvedValue("https://signed") }));
vi.mock("./client-file.repository", () => ({
  clientFileRepository: { findById: vi.fn(), findByClientId: vi.fn(), create: vi.fn(), remove: vi.fn(), recordBelongsToClient: vi.fn() },
}));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { findById: vi.fn(), findByIdIncludingDeleted: vi.fn() } }));

import { clientFileService, resolveLocalUploadPath } from "./client-file.service";
import { clientFileRepository } from "./client-file.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { s3Client } from "../../config/s3";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};
const FILE = { id: "f1", clientId: "c1", filename: "client-files/1.pdf", originalName: "a.pdf", mimeType: "application/pdf" };
const MULTER = { originalname: "a.pdf", mimetype: "application/pdf", size: 3, buffer: Buffer.from("abc") } as Express.Multer.File;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1" } as never);
  vi.mocked(clientFileRepository.findById).mockResolvedValue(FILE as never);
});

describe("clientFileService tenant scoping", () => {
  beforeEach(() => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
  });

  it("list 404s for an out-of-scope client", async () => {
    await expect(clientFileService.listByClientId("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientFileRepository.findByClientId).not.toHaveBeenCalled();
    expect(neonClientRepository.findById).toHaveBeenCalledWith("c1", SCOPE);
  });

  it("upload 404s before touching S3 or the DB", async () => {
    await expect(clientFileService.upload("c1", MULTER, {}, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(clientFileRepository.create).not.toHaveBeenCalled();
  });

  it("download 404s when the file's client is out of scope", async () => {
    await expect(clientFileService.getDownloadTarget("f1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientRepository.findById).toHaveBeenCalledWith("c1", SCOPE);
  });

  it("delete 404s and removes nothing", async () => {
    await expect(clientFileService.delete("f1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(clientFileRepository.remove).not.toHaveBeenCalled();
  });

  it("a missing file is also a 404", async () => {
    vi.mocked(clientFileRepository.findById).mockResolvedValue(null);
    await expect(clientFileService.delete("nope", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("clientFileService in scope", () => {
  it("lists the client's files", async () => {
    vi.mocked(clientFileRepository.findByClientId).mockResolvedValue([{ ...FILE, uploadedByName: "Sam" }] as never);
    const rows = await clientFileService.listByClientId("c1", SCOPE);
    expect(rows[0]).toMatchObject({ uploadedByName: "Sam" });
  });

  it("upload records the uploader", async () => {
    vi.mocked(clientFileRepository.create).mockResolvedValue(FILE as never);
    await clientFileService.upload("c1", MULTER, {}, SCOPE);
    expect(vi.mocked(clientFileRepository.create).mock.calls[0][0]).toMatchObject({ clientId: "c1", uploadedBy: "u1" });
  });

  it("download returns a signed url", async () => {
    await expect(clientFileService.getDownloadTarget("f1", SCOPE)).resolves.toEqual({ kind: "s3", url: "https://signed" });
  });

  it("delete removes the S3 object and the row", async () => {
    await clientFileService.delete("f1", SCOPE);
    expect(s3Client.send).toHaveBeenCalledOnce();
    expect(clientFileRepository.remove).toHaveBeenCalledWith("f1");
  });
});

describe("clientFileService - soft-deleted client is read-only", () => {
  const ADMIN: Scope = { ...SCOPE, orgRole: "org_admin", orgRoles: ["org_admin"] };

  beforeEach(() => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined);
    vi.mocked(neonClientRepository.findByIdIncludingDeleted).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(clientFileRepository.findByClientId).mockResolvedValue([]);
  });

  it("an admin can list a deleted client's files", async () => {
    await expect(clientFileService.listByClientId("c1", ADMIN)).resolves.toEqual([]);
  });

  it("a non-admin gets 404 listing them", async () => {
    await expect(clientFileService.listByClientId("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientRepository.findByIdIncludingDeleted).not.toHaveBeenCalled();
  });

  it("an admin's upload is still blocked", async () => {
    await expect(clientFileService.upload("c1", MULTER, {}, ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientFileRepository.create).not.toHaveBeenCalled();
  });
});

describe("upload allocation is validated", () => {
  const REC = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.mocked(clientFileRepository.create).mockResolvedValue(FILE as never);
    vi.mocked(clientFileRepository.recordBelongsToClient).mockResolvedValue(true);
  });

  it("a real record of that kind on this client is accepted and stored", async () => {
    await clientFileService.upload("c1", MULTER, { allocationType: "Booking", allocationId: REC }, SCOPE);
    expect(clientFileRepository.recordBelongsToClient).toHaveBeenCalledWith("booking", REC, "c1");
    expect(vi.mocked(clientFileRepository.create).mock.calls[0][0]).toMatchObject({ allocationType: "Booking", allocationId: REC });
  });

  it("a record that is not this client's is a 400 and nothing is stored", async () => {
    vi.mocked(clientFileRepository.recordBelongsToClient).mockResolvedValue(false);
    await expect(clientFileService.upload("c1", MULTER, { allocationType: "Quote", allocationId: REC }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(s3Client.send).not.toHaveBeenCalled();
    expect(clientFileRepository.create).not.toHaveBeenCalled();
  });

  it("a type without an id, or an unknown type, is a 400", async () => {
    await expect(clientFileService.upload("c1", MULTER, { allocationType: "Enquiry" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    await expect(clientFileService.upload("c1", MULTER, { allocationType: "Invoice", allocationId: REC }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(clientFileRepository.create).not.toHaveBeenCalled();
  });

  it("None or blank needs no id, and any id sent with it is dropped", async () => {
    await clientFileService.upload("c1", MULTER, { allocationType: "None", allocationId: "x" }, SCOPE);
    expect(vi.mocked(clientFileRepository.create).mock.calls[0][0]).toMatchObject({ allocationType: "None" });
    await clientFileService.upload("c1", MULTER, {}, SCOPE);
    expect(vi.mocked(clientFileRepository.create).mock.calls[1][0]).toMatchObject({ allocationType: null, allocationId: null });
    expect(clientFileRepository.recordBelongsToClient).not.toHaveBeenCalled();
  });
});

describe("legacy disk files cannot escape the uploads directory", () => {
  it.each(["../secret.txt", "../../etc/passwd", "a/../../b", "/etc/passwd", ".."])("refuses %s", (name) => {
    expect(resolveLocalUploadPath(name)).toBeNull();
  });

  it("keeps a plain legacy name inside the directory", () => {
    const p = resolveLocalUploadPath("1748392910-123.pdf");
    expect(p).not.toBeNull();
    expect(p).toContain("client-files");
  });

  it("download of an escaping name is the existing 404, delete removes only the row", async () => {
    vi.mocked(clientFileRepository.findById).mockResolvedValue({ ...FILE, filename: "../../etc/passwd" } as never);
    await expect(clientFileService.getDownloadTarget("f1", SCOPE)).rejects.toMatchObject({ statusCode: 404, message: "File not found on disk" });
    await clientFileService.delete("f1", SCOPE);
    expect(clientFileRepository.remove).toHaveBeenCalledWith("f1");
  });
});
