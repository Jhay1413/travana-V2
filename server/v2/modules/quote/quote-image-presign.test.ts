import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-image.repository", () => ({
  quoteImageRepository: {
    addImages: vi.fn(),
    getImageUrl: vi.fn(),
    deleteImage: vi.fn(),
    isUrlReferenced: vi.fn(),
    setPrimaryImage: vi.fn(),
    getByQuoteId: vi.fn(),
  },
}));

vi.mock("../../utils/image-storage", () => ({
  uploadImageToS3: vi.fn(),
  deleteImageByStoredUrl: vi.fn(),
  s3KeyFromStoredUrl: vi.fn(() => null),
  buildImageKey: vi.fn((keyPrefix: string, filename: string) => `${keyPrefix}/fixed-key-${filename}`),
  buildImageProxyUrl: vi.fn((key: string) => `/api/v2/files/img?key=${encodeURIComponent(key)}`),
  getPresignedPutUrl: vi.fn(async (key: string, contentType: string) => `https://s3.example.com/${key}?contentType=${contentType}&sig=abc`),
  ALLOWED_IMAGE_MIME_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif"],
}));

import { quoteImageService } from "./quote-image.service";
import { quoteImageController } from "./quote-image.controller";
import { presignQuoteImagesValidator } from "./quote.validator";
import { buildImageKey, getPresignedPutUrl } from "../../utils/image-storage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("presignQuoteImagesValidator", () => {
  it("accepts a valid request shape", () => {
    const result = presignQuoteImagesValidator.safeParse({
      body: { files: [{ filename: "beach.jpg", contentType: "image/jpeg" }] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported contentType", () => {
    const result = presignQuoteImagesValidator.safeParse({
      body: { files: [{ filename: "doc.pdf", contentType: "application/pdf" }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty files array", () => {
    const result = presignQuoteImagesValidator.safeParse({ body: { files: [] } });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 files", () => {
    const files = Array.from({ length: 51 }, (_, i) => ({
      filename: `f${i}.jpg`,
      contentType: "image/jpeg" as const,
    }));
    const result = presignQuoteImagesValidator.safeParse({ body: { files } });
    expect(result.success).toBe(false);
  });
});

describe("quoteImageService.presignUploads", () => {
  it("returns an uploadUrl/key/proxyUrl per file, using the server-generated key", async () => {
    const results = await quoteImageService.presignUploads([
      { filename: "beach.jpg", contentType: "image/jpeg" },
    ]);

    expect(results).toHaveLength(1);
    expect(vi.mocked(buildImageKey)).toHaveBeenCalledWith("quote-images", "beach.jpg", "image/jpeg");
    expect(results[0].key).toBe("quote-images/fixed-key-beach.jpg");
    expect(results[0].proxyUrl).toBe(`/api/v2/files/img?key=${encodeURIComponent(results[0].key)}`);
    expect(results[0].uploadUrl).toContain(results[0].key);
    expect(vi.mocked(getPresignedPutUrl)).toHaveBeenCalledWith(results[0].key, "image/jpeg");
  });

  it("presigns multiple files independently", async () => {
    const results = await quoteImageService.presignUploads([
      { filename: "a.jpg", contentType: "image/jpeg" },
      { filename: "b.png", contentType: "image/png" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].key).not.toBe(results[1].key);
  });
});

describe("quoteImageController.presignUploads", () => {
  function mockRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  it("forwards the validated files to the service and returns the results", async () => {
    const res = mockRes();
    const req = { body: { files: [{ filename: "beach.jpg", contentType: "image/jpeg" }] } } as any;

    await quoteImageController.presignUploads(req, res, vi.fn());
    // asyncHandler's wrapper doesn't return the inner promise (see
    // async-handler.ts), so awaiting the call above only flushes one
    // microtask tick — flush a few more so the service's Promise.all chain
    // (buildImageKey -> await getPresignedPutUrl -> object construction)
    // finishes before asserting on the response (same pattern used for the
    // error-propagation case in quote.controller.test.ts).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].key).toBe("quote-images/fixed-key-beach.jpg");
    expect(payload.data[0].proxyUrl).toBe(`/api/v2/files/img?key=${encodeURIComponent(payload.data[0].key)}`);
  });
});
