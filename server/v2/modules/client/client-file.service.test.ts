import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/s3", () => ({ s3Client: { send: vi.fn().mockResolvedValue({}) }, S3_BUCKET: "bucket" }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn().mockResolvedValue("https://signed") }));
vi.mock("./client-file.repository", () => ({
  clientFileRepository: { findById: vi.fn(), findByClientId: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { findById: vi.fn() } }));

import { clientFileService } from "./client-file.service";
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
