import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("../../config/s3", () => ({ s3Client: { send: vi.fn() }, S3_BUCKET: "bucket" }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("./client-file.repository", () => ({ clientFileRepository: {} }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: {} }));

import { clientFileService } from "./client-file.service";
import { s3Client } from "../../config/s3";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("readObjectHead", () => {
  it("object storage: a ranged read, with the total size taken from Content-Range", async () => {
    vi.mocked(s3Client.send).mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) },
      ContentRange: "bytes 0-15/123456",
      ContentLength: 16,
    } as never);
    const out = await clientFileService.readObjectHead({ filename: "client-files/k.pdf" }, 16);
    expect(out.size).toBe(123456);
    expect(out.head.toString("latin1")).toBe("%PDF-");
    const command = vi.mocked(s3Client.send).mock.calls[0][0] as unknown as { input: { Key: string; Range: string } };
    expect(command.input).toMatchObject({ Key: "client-files/k.pdf", Range: "bytes=0-15" });
  });

  it("object storage: a missing object is a 404; an empty object reads as empty", async () => {
    vi.mocked(s3Client.send).mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "NoSuchKey" }));
    await expect(clientFileService.readObjectHead({ filename: "client-files/k.pdf" }, 16)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(s3Client.send).mockRejectedValueOnce(Object.assign(new Error("range"), { name: "InvalidRange" }));
    await expect(clientFileService.readObjectHead({ filename: "client-files/k.pdf" }, 16)).resolves.toEqual({ head: Buffer.alloc(0), size: 0 });
  });

  it("object storage: any other failure is passed on", async () => {
    vi.mocked(s3Client.send).mockRejectedValue(new Error("network"));
    await expect(clientFileService.readObjectHead({ filename: "client-files/k.pdf" }, 16)).rejects.toThrow("network");
  });

  it("a legacy name that escapes the uploads directory is refused before any disk access", async () => {
    await expect(clientFileService.readObjectHead({ filename: "../../etc/passwd" }, 16)).rejects.toMatchObject({ statusCode: 404 });
    await expect(clientFileService.readObjectHead({ filename: "/etc/passwd" }, 16)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a legacy file that is not on disk is a 404", async () => {
    await expect(clientFileService.readObjectHead({ filename: "no-such-file-for-test.pdf" }, 16)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("openObjectStream", () => {
  it("object storage: relays the body stream with its length, and passes the abort signal", async () => {
    const body = Readable.from([Buffer.from("abc")]);
    vi.mocked(s3Client.send).mockResolvedValue({ Body: body, ContentLength: 3 } as never);
    const abort = new AbortController();
    const out = await clientFileService.openObjectStream({ filename: "client-files/k.pdf" }, abort.signal);
    expect(out.stream).toBe(body);
    expect(out.size).toBe(3);
    expect(vi.mocked(s3Client.send).mock.calls[0][1]).toEqual({ abortSignal: abort.signal });
    body.destroy();
  });

  it("object storage: a missing object is a 404 and a body that is not a stream is an error", async () => {
    vi.mocked(s3Client.send).mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "NoSuchKey" }));
    await expect(clientFileService.openObjectStream({ filename: "client-files/k.pdf" })).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(s3Client.send).mockResolvedValueOnce({ Body: undefined } as never);
    await expect(clientFileService.openObjectStream({ filename: "client-files/k.pdf" })).rejects.toThrow();
  });

  it("a legacy name that escapes the uploads directory is refused, and a missing legacy file is a 404", async () => {
    await expect(clientFileService.openObjectStream({ filename: "../secret.pdf" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(clientFileService.openObjectStream({ filename: "no-such-file-for-test.pdf" })).rejects.toMatchObject({ statusCode: 404 });
  });
});
