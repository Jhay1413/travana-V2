import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveUploadableUrl: vi.fn(),
  axiosGet: vi.fn(),
  imageSize: vi.fn(),
  uploadBufferToS3: vi.fn(),
  recordAiUsage: vi.fn(),
  falSubscribe: vi.fn(),
  assertPublicHttpUrl: vi.fn(),
  isAxiosError: vi.fn(),
}));

vi.mock("../social-post/social-post.service", () => ({
  resolveUploadableUrl: mocks.resolveUploadableUrl,
}));
vi.mock("axios", () => ({ default: { get: mocks.axiosGet, isAxiosError: mocks.isAxiosError } }));
vi.mock("../../utils/safe-fetch-url", () => ({ assertPublicHttpUrl: mocks.assertPublicHttpUrl }));
vi.mock("image-size", () => ({ imageSize: mocks.imageSize }));
vi.mock("../../utils/image-storage", () => ({
  uploadBufferToS3: mocks.uploadBufferToS3,
  presignImageKey: vi.fn(async (key: string) => `https://s3.test/${key}`),
  s3KeyFromStoredUrl: (url: string) =>
    url.startsWith("/api/v2/files/img?key=") ? decodeURIComponent(url.split("key=")[1]) : null,
}));
vi.mock("../usage/usage.service", () => ({ usageService: { recordAiUsage: mocks.recordAiUsage } }));
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: mocks.falSubscribe } }));

import { createUpscalePipeline } from "./image-upscale.pipeline";
import { falEsrganProvider, FAL_TIMEOUT_MS } from "./providers/fal-esrgan.provider";
import { AppError } from "../../utils/error-handler";
import type { PerformUpscaleInput, UpscaleProvider } from "./image-upscale.types";

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const IMG = "/api/v2/files/img?key=quotes%2Fa.jpg";
const UPLOAD = "/api/v2/files/img?key=social-upscale%2Fsource%2Fx.jpg";
const RESULT = "/api/v2/files/img?key=social-upscale%2Fout.jpg";

const provider = { upscale: vi.fn() } satisfies UpscaleProvider;

const quoteInput: PerformUpscaleInput = {
  originalUrl: IMG,
  sourceKind: "quote_image",
  quoteId: QUOTE_ID,
  orgId: "org-1",
  userId: "user-1",
};

function setSourceWidth(width: number) {
  mocks.imageSize.mockReturnValueOnce({ width, height: Math.round(width * 0.75) }); // source
  mocks.imageSize.mockReturnValueOnce({ width: 3840, height: 2880 }); // result
}

describe("upscale pipeline performUpscale", () => {
  const pipeline = createUpscalePipeline(provider);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUploadableUrl.mockResolvedValue("https://s3.test/signed-a.jpg");
    mocks.assertPublicHttpUrl.mockResolvedValue(undefined);
    mocks.isAxiosError.mockReturnValue(false);
    mocks.axiosGet.mockResolvedValue({ data: new ArrayBuffer(8) });
    mocks.uploadBufferToS3.mockResolvedValue(RESULT);
    provider.upscale.mockResolvedValue({
      url: "https://fal.test/out.jpg",
      width: 3840,
      height: 2880,
      contentType: "image/jpeg",
    });
  });

  it("chooses scale 4 for a 1000px image", async () => {
    setSourceWidth(1000);
    const result = await pipeline.performUpscale(quoteInput);
    expect(provider.upscale).toHaveBeenCalledWith({ imageUrl: "https://s3.test/signed-a.jpg", scale: 4 });
    expect(result.scale).toBe(4);
    expect(result.sourceWidth).toBe(1000);
  });

  it("chooses scale 2 for a 1920px image", async () => {
    setSourceWidth(1920);
    const result = await pipeline.performUpscale(quoteInput);
    expect(provider.upscale).toHaveBeenCalledWith(expect.objectContaining({ scale: 2 }));
    expect(result.scale).toBe(2);
  });

  it("rejects images already 3840px wide or larger", async () => {
    mocks.imageSize.mockReturnValueOnce({ width: 3840, height: 2160 });
    await expect(pipeline.performUpscale(quoteInput)).rejects.toMatchObject({
      statusCode: 400,
      message: "Image is already 4K or larger",
    });
    expect(provider.upscale).not.toHaveBeenCalled();
  });

  it("stores the result under social-upscale/ and records usage", async () => {
    setSourceWidth(1000);
    const result = await pipeline.performUpscale(quoteInput);
    expect(mocks.uploadBufferToS3).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg", "social-upscale");
    expect(result.url).toBe(RESULT);
    expect(result.width).toBe(3840);
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", feature: "image_upscale", userId: "user-1" }),
    );
  });

  it("never touches the quote itself (the worker does that after persisting the result)", async () => {
    setSourceWidth(1000);
    const result = await pipeline.performUpscale(quoteInput);
    expect(result).not.toHaveProperty("replacedOnQuote");
  });

  it("returns null dimensions (not 0) when neither image-size nor the provider knows them", async () => {
    mocks.imageSize.mockReturnValueOnce({ width: 1000, height: 750 }); // source
    mocks.imageSize.mockImplementationOnce(() => {
      throw new Error("unreadable");
    }); // result
    provider.upscale.mockResolvedValue({ url: "https://fal.test/out.jpg", width: 0, height: 0, contentType: "image/jpeg" });
    const result = await pipeline.performUpscale(quoteInput);
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });

  it("does not run the public-host guard for our own storage (presigned S3)", async () => {
    setSourceWidth(1000);
    await pipeline.performUpscale(quoteInput);
    expect(mocks.assertPublicHttpUrl).not.toHaveBeenCalled();
  });

  it("guards an external quote image url and refuses redirects", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("https://cdn.example.com/a.jpg");
    setSourceWidth(1000);
    await pipeline.performUpscale({ ...quoteInput, originalUrl: "https://cdn.example.com/a.jpg" });
    expect(mocks.assertPublicHttpUrl).toHaveBeenCalledWith("https://cdn.example.com/a.jpg");
    expect(mocks.axiosGet).toHaveBeenNthCalledWith(1, "https://cdn.example.com/a.jpg", expect.objectContaining({ maxRedirects: 0 }));
  });

  it("rejects an external url that fails the guard before any download", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("http://169.254.169.254/latest");
    mocks.assertPublicHttpUrl.mockRejectedValue(new AppError("Image URL points to a private address", 400));
    await expect(
      pipeline.performUpscale({ ...quoteInput, originalUrl: "http://169.254.169.254/latest" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.axiosGet).not.toHaveBeenCalled();
    expect(provider.upscale).not.toHaveBeenCalled();
  });

  it("turns a redirect from an external host into a clear 400", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("https://cdn.example.com/a.jpg");
    mocks.isAxiosError.mockReturnValue(true);
    mocks.axiosGet.mockRejectedValue({ response: { status: 302 } });
    await expect(
      pipeline.performUpscale({ ...quoteInput, originalUrl: "https://cdn.example.com/a.jpg" }),
    ).rejects.toMatchObject({ statusCode: 400, message: "Image URL redirects are not allowed" });
  });

  it("presigns an uploaded source and never touches the quote", async () => {
    setSourceWidth(1000);
    const result = await pipeline.performUpscale({ ...quoteInput, originalUrl: UPLOAD, sourceKind: "upload" });
    expect(mocks.resolveUploadableUrl).not.toHaveBeenCalled();
    expect(provider.upscale).toHaveBeenCalledWith({ imageUrl: "https://s3.test/social-upscale/source/x.jpg", scale: 4 });
  });

  it("stores a standalone upload (no quote) under image-upscale/", async () => {
    setSourceWidth(1000);
    await pipeline.performUpscale({ ...quoteInput, originalUrl: UPLOAD, sourceKind: "upload", quoteId: null });
    expect(mocks.uploadBufferToS3).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg", "image-upscale");
  });

  it("propagates a provider failure as 502", async () => {
    setSourceWidth(1000);
    provider.upscale.mockRejectedValue(new AppError("Image upscaling failed. Please try again.", 502));
    await expect(pipeline.performUpscale(quoteInput)).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("falEsrganProvider", () => {
  const original = process.env.FAL_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = original;
  });

  it("throws 500 when FAL_KEY is missing", async () => {
    delete process.env.FAL_KEY;
    await expect(falEsrganProvider.upscale({ imageUrl: "https://x/y.jpg", scale: 2 })).rejects.toMatchObject({
      statusCode: 500,
      message: "Image upscaler is not configured (FAL_KEY)",
    });
  });

  it("maps fal failures to 502", async () => {
    process.env.FAL_KEY = "test";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.falSubscribe.mockRejectedValue(new Error("boom"));
    await expect(falEsrganProvider.upscale({ imageUrl: "https://x/y.jpg", scale: 2 })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("times out a hung fal call with a 502", async () => {
    vi.useFakeTimers();
    try {
      process.env.FAL_KEY = "test";
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.falSubscribe.mockReturnValue(new Promise(() => undefined));
      const pending = falEsrganProvider.upscale({ imageUrl: "https://x/y.jpg", scale: 2 });
      const assertion = expect(pending).rejects.toMatchObject({ statusCode: 502, message: "Image upscaling timed out" });
      await vi.advanceTimersByTimeAsync(FAL_TIMEOUT_MS + 1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the parsed image on success", async () => {
    process.env.FAL_KEY = "test";
    mocks.falSubscribe.mockResolvedValue({
      data: { image: { url: "https://fal.test/o.jpg", width: 10, height: 5, content_type: "image/jpeg" } },
    });
    await expect(falEsrganProvider.upscale({ imageUrl: "https://x/y.jpg", scale: 4 })).resolves.toEqual({
      url: "https://fal.test/o.jpg",
      width: 10,
      height: 5,
      contentType: "image/jpeg",
    });
  });
});
