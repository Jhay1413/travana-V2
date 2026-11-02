import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../config/s3", () => ({ s3Client: { send: vi.fn() }, S3_BUCKET: "bucket" }));
vi.mock("../../utils/image-storage", async () => {
  const actual = await vi.importActual<typeof import("../../utils/image-storage")>("../../utils/image-storage");
  return { ...actual, presignImageKey: vi.fn() };
});

import { fileController } from "./file.controller";
import { presignImageKey } from "../../utils/image-storage";

function call(key: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), redirect: vi.fn().mockReturnThis() };
  const next = vi.fn();
  fileController.serveImage({ query: { key } } as unknown as Request, res as unknown as Response, next);
  return { res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(presignImageKey).mockResolvedValue("https://signed.test/x");
});

describe("GET /files/img", () => {
  it("redirects to a presigned url for a public image key", async () => {
    const { res } = call("quote-images/1-a.jpg");
    await Promise.resolve();
    await Promise.resolve();
    expect(presignImageKey).toHaveBeenCalledWith("quote-images/1-a.jpg");
    expect(res.redirect).toHaveBeenCalledWith(302, "https://signed.test/x");
  });

  it("serves a tour operator logo key and every training media key", async () => {
    for (const key of ["tour-operator-logos/1-a.png", "training-assets/1-a.jpg", "training-thumbnails/1-a.jpg", "training-videos/1-a.mp4"]) {
      const { res } = call(key);
      await Promise.resolve();
      await Promise.resolve();
      expect(presignImageKey, key).toHaveBeenCalledWith(key);
      expect(res.redirect, key).toHaveBeenCalledWith(302, "https://signed.test/x");
    }
  });

  it("never signs a key outside the public image prefixes (404)", async () => {
    for (const key of ["client-files/1.pdf", "hr/doc.pdf", "note-attachments/1.pdf", "ticket-attachments/1.pdf", "../etc/passwd", "quote-images/../hr/doc.pdf"]) {
      const { res } = call(key);
      await Promise.resolve();
      expect(res.status, key).toHaveBeenCalledWith(404);
      expect(res.redirect, key).not.toHaveBeenCalled();
    }
    expect(presignImageKey).not.toHaveBeenCalled();
  });

  it("400s without a key", async () => {
    const { res } = call(undefined);
    await Promise.resolve();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
