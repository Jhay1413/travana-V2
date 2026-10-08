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
  fetchViaHeadlessBrowser: vi.fn(),
  toSquare: vi.fn(),
}));
vi.mock("./image-format.util", () => ({ toSquare: mocks.toSquare }));
vi.mock("../../utils/browser-fetch", () => ({ fetchViaHeadlessBrowser: mocks.fetchViaHeadlessBrowser }));

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

/** 4:3 source of the given width unless a height is given. */
function setSourceWidth(width: number, height = Math.round(width * 0.75), type = "jpg") {
  mocks.imageSize.mockReturnValueOnce({ width, height, type });
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
    mocks.toSquare.mockResolvedValue({ buffer: Buffer.from("sq"), contentType: "image/jpeg", width: 1080, height: 1080 });
    provider.upscale.mockResolvedValue({
      url: "https://fal.test/out.jpg",
      width: 2160,
      height: 1440,
      contentType: "image/jpeg",
    });
  });

  it("chooses scale 3 for a 600x450 image", async () => {
    setSourceWidth(600);
    const result = await pipeline.performUpscale(quoteInput);
    expect(provider.upscale).toHaveBeenCalledWith({ imageUrl: "https://s3.test/signed-a.jpg", scale: 3 });
    expect(result.scale).toBe(3);
    expect(result.sourceWidth).toBe(600);
  });

  it("1080x608: upscales 2x (short side 608) then squares to 1080x1080", async () => {
    setSourceWidth(1080, 608);
    const result = await pipeline.performUpscale(quoteInput);
    expect(provider.upscale).toHaveBeenCalledWith(expect.objectContaining({ scale: 2 }));
    expect(mocks.toSquare).toHaveBeenCalledWith(expect.any(Buffer), 1080, false);
    expect(result).toMatchObject({ scale: 2, width: 1080, height: 1080, sourceWidth: 1080, sourceHeight: 608 });
  });

  it("800x600: scale 2 (ceil(1080/600))", async () => {
    setSourceWidth(800, 600);
    const result = await pipeline.performUpscale(quoteInput);
    expect(result.scale).toBe(2);
  });

  it("caps the scale at 4 for a 200px short side (best effort)", async () => {
    setSourceWidth(400, 200);
    const result = await pipeline.performUpscale(quoteInput);
    expect(result.scale).toBe(4);
  });

  it("4000x2667: no provider call, crop only with scale 1", async () => {
    setSourceWidth(4000, 2667);
    const result = await pipeline.performUpscale(quoteInput);
    expect(provider.upscale).not.toHaveBeenCalled();
    expect(mocks.toSquare).toHaveBeenCalledTimes(1);
    expect(mocks.recordAiUsage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ scale: 1, width: 1080, height: 1080 });
  });

  it("1080x1080 is rejected with 400 and nothing runs", async () => {
    setSourceWidth(1080, 1080);
    await expect(pipeline.performUpscale(quoteInput)).rejects.toMatchObject({
      statusCode: 400,
      message: "Image is already 1080×1080",
    });
    expect(provider.upscale).not.toHaveBeenCalled();
    expect(mocks.toSquare).not.toHaveBeenCalled();
  });

  it("PNG sources stay PNG", async () => {
    mocks.axiosGet.mockResolvedValueOnce({ data: new ArrayBuffer(8), headers: { "content-type": "image/png" } });
    mocks.resolveUploadableUrl.mockResolvedValue("https://cdn.example.com/a.png");
    mocks.uploadBufferToS3.mockResolvedValueOnce(RESULT);
    mocks.toSquare.mockResolvedValue({ buffer: Buffer.from("sq"), contentType: "image/png", width: 1080, height: 1080 });
    setSourceWidth(3000, 2000, "png");
    await pipeline.performUpscale({ ...quoteInput, originalUrl: "https://cdn.example.com/a.png" });
    expect(mocks.toSquare).toHaveBeenCalledWith(expect.any(Buffer), 1080, true);
    expect(mocks.uploadBufferToS3).toHaveBeenCalledWith(expect.any(Buffer), "image/png", "social-upscale");
  });

  it("turns a formatter failure into a 422", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setSourceWidth(3000, 2000);
    mocks.toSquare.mockRejectedValue(new Error("bad image"));
    await expect(pipeline.performUpscale(quoteInput)).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.uploadBufferToS3).not.toHaveBeenCalled();
  });

  it("stores the result under social-upscale/ and records usage", async () => {
    setSourceWidth(600);
    const result = await pipeline.performUpscale(quoteInput);
    expect(mocks.uploadBufferToS3).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg", "social-upscale");
    expect(result.url).toBe(RESULT);
    expect(result.width).toBe(1080);
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", feature: "image_upscale", userId: "user-1" }),
    );
  });

  it("never touches the quote itself (the worker does that after persisting the result)", async () => {
    setSourceWidth(600);
    const result = await pipeline.performUpscale(quoteInput);
    expect(result).not.toHaveProperty("replacedOnQuote");
  });

  it("does not run the public-host guard for our own storage (presigned S3)", async () => {
    setSourceWidth(600);
    await pipeline.performUpscale(quoteInput);
    expect(mocks.assertPublicHttpUrl).not.toHaveBeenCalled();
  });

  it("guards an external quote image url and refuses redirects", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("https://cdn.example.com/a.jpg");
    setSourceWidth(600);
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

  it("falls back to the headless browser on a 403, stores our copy and gives the provider the presigned copy", async () => {
    const tui = "https://content.tui.co.uk/a.jpg";
    mocks.resolveUploadableUrl.mockResolvedValue(tui);
    mocks.isAxiosError.mockReturnValue(true);
    mocks.axiosGet.mockRejectedValueOnce({ response: { status: 403 } });
    mocks.fetchViaHeadlessBrowser.mockResolvedValue({ buffer: Buffer.from("webp"), contentType: "image/webp", status: 200 });
    mocks.uploadBufferToS3.mockResolvedValueOnce("/api/v2/files/img?key=social-upscale%2Fsource%2Fcopy.webp");
    setSourceWidth(600);
    await pipeline.performUpscale({ ...quoteInput, originalUrl: tui });
    expect(mocks.fetchViaHeadlessBrowser).toHaveBeenCalledWith(tui, expect.objectContaining({ maxBytes: expect.any(Number) }));
    expect(mocks.uploadBufferToS3).toHaveBeenNthCalledWith(1, expect.any(Buffer), "image/webp", "social-upscale/source");
    expect(provider.upscale).toHaveBeenCalledWith({ imageUrl: "https://s3.test/social-upscale/source/copy.webp", scale: 3 });
  });

  it("uploads a source copy for a directly downloaded external image too", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("https://cdn.example.com/a.jpg");
    mocks.axiosGet.mockResolvedValueOnce({ data: new ArrayBuffer(8), headers: { "content-type": "image/png; charset=x" } });
    mocks.uploadBufferToS3.mockResolvedValueOnce("/api/v2/files/img?key=social-upscale%2Fsource%2Fcopy.png");
    setSourceWidth(600);
    await pipeline.performUpscale({ ...quoteInput, originalUrl: "https://cdn.example.com/a.jpg" });
    expect(mocks.fetchViaHeadlessBrowser).not.toHaveBeenCalled();
    expect(mocks.uploadBufferToS3).toHaveBeenNthCalledWith(1, expect.any(Buffer), "image/png", "social-upscale/source");
    expect(provider.upscale).toHaveBeenCalledWith({ imageUrl: "https://s3.test/social-upscale/source/copy.png", scale: 3 });
  });

  it("does not upload a source copy for own-storage urls", async () => {
    setSourceWidth(600);
    await pipeline.performUpscale(quoteInput);
    expect(mocks.uploadBufferToS3).toHaveBeenCalledTimes(1); // result only
    expect(mocks.fetchViaHeadlessBrowser).not.toHaveBeenCalled();
  });

  it("fails with the generic message when the headless browser also fails", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("https://content.tui.co.uk/a.jpg");
    mocks.isAxiosError.mockReturnValue(true);
    mocks.axiosGet.mockRejectedValue({ response: { status: 403 } });
    mocks.fetchViaHeadlessBrowser.mockRejectedValue(new Error("status 403"));
    await expect(
      pipeline.performUpscale({ ...quoteInput, originalUrl: "https://content.tui.co.uk/a.jpg" }),
    ).rejects.toMatchObject({ statusCode: 502, message: "Could not download the source image" });
    expect(provider.upscale).not.toHaveBeenCalled();
  });

  it("runs the SSRF guard before any download or browser navigation", async () => {
    mocks.resolveUploadableUrl.mockResolvedValue("http://10.0.0.1/a.jpg");
    mocks.assertPublicHttpUrl.mockRejectedValue(new AppError("Image URL points to a private address", 400));
    await expect(pipeline.performUpscale({ ...quoteInput, originalUrl: "http://10.0.0.1/a.jpg" })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.fetchViaHeadlessBrowser).not.toHaveBeenCalled();
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it("presigns an uploaded source and never touches the quote", async () => {
    setSourceWidth(600);
    const result = await pipeline.performUpscale({ ...quoteInput, originalUrl: UPLOAD, sourceKind: "upload" });
    expect(mocks.resolveUploadableUrl).not.toHaveBeenCalled();
    expect(provider.upscale).toHaveBeenCalledWith({ imageUrl: "https://s3.test/social-upscale/source/x.jpg", scale: 3 });
  });

  it("stores a standalone upload (no quote) under image-upscale/", async () => {
    setSourceWidth(600);
    await pipeline.performUpscale({ ...quoteInput, originalUrl: UPLOAD, sourceKind: "upload", quoteId: null });
    expect(mocks.uploadBufferToS3).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg", "image-upscale");
  });

  it("propagates a provider failure as 502", async () => {
    setSourceWidth(600);
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
