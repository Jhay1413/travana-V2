import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ImageUpscaleJob } from "@shared/schema";

const mocks = vi.hoisted(() => ({
  fetchSource: vi.fn(),
  readDimensions: vi.fn(),
  createInlineJob: vi.fn(),
  runJobInline: vi.fn(),
  uploadImageToS3: vi.fn(),
  repo: {
    findLatestDoneByOriginal: vi.fn(),
    findDoneByResultUrl: vi.fn(),
  },
}));

vi.mock("../../utils/image-storage", () => ({
  uploadImageToS3: mocks.uploadImageToS3,
  s3KeyFromStoredUrl: (url: string) =>
    url.startsWith("/api/v2/files/img?key=") ? decodeURIComponent(url.split("key=")[1]) : null,
}));
vi.mock("./image-upscale.repository", () => ({ imageUpscaleRepository: mocks.repo }));
vi.mock("./image-upscale.service", () => ({ imageUpscaleService: { createInlineJob: mocks.createInlineJob } }));
vi.mock("./image-upscale.worker", () => ({ imageUpscaleWorker: { runJobInline: mocks.runJobInline } }));
vi.mock("./image-upscale.pipeline", () => ({
  SOURCE_PREFIX: "social-upscale/source",
  fetchSourceForUpscale: mocks.fetchSource,
  readDimensions: mocks.readDimensions,
}));

import { autoUpscaleService, AUTO_UPSCALE_BUDGET_MS } from "./auto-upscale.service";

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const scope = { orgId: "org-1", userId: "user-1" };
const SMALL = "/api/v2/files/img?key=quotes%2Fsmall.jpg";
const SMALL_2 = "https://cdn.example.com/small2.jpg";
const BIG = "https://cdn.example.com/big.jpg";
const RESULT = "/api/v2/files/img?key=social-upscale%2Fout.jpg";

function makeJob(overrides: Partial<ImageUpscaleJob> = {}): ImageUpscaleJob {
  return {
    id: "job-1",
    orgId: "org-1",
    createdBy: "user-1",
    quoteId: QUOTE_ID,
    sourceKind: "quote_image",
    originalUrl: SMALL,
    resultUrl: RESULT,
    status: "done",
    error: null,
    scale: 2,
    sourceWidth: 1000,
    sourceHeight: 750,
    resultWidth: 1080,
    resultHeight: 1080,
    replacedOnQuote: false,
    revertedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function source(width: number | null, bytes = 1_000_000, height = width ? Math.round(width * 0.75) : 0) {
  return {
    buffer: Buffer.alloc(bytes),
    contentType: "image/jpeg",
    dims: width ? { width, height, type: "jpg" } : null,
    ownStorage: true,
    fetchableUrl: "https://s3.test/x",
  };
}

function makeFile(name: string, mimetype = "image/jpeg", bytes = 1000): Express.Multer.File {
  return { originalname: name, mimetype, buffer: Buffer.alloc(bytes) } as Express.Multer.File;
}

describe("autoUpscaleService.prepareImagesForPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.repo.findLatestDoneByOriginal.mockResolvedValue(null);
    mocks.repo.findDoneByResultUrl.mockResolvedValue(null);
    mocks.createInlineJob.mockImplementation(async () => ({ kind: "created", job: makeJob({ status: "queued" }) }));
    mocks.runJobInline.mockResolvedValue(makeJob());
    mocks.uploadImageToS3.mockResolvedValue("/api/v2/files/img?key=social-upscale%2Fsource%2Fup.jpg");
    mocks.readDimensions.mockReturnValue({ width: 800, height: 600, type: "jpg" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const run = (imageUrls: string[], files: Express.Multer.File[] = []) =>
    autoUpscaleService.prepareImagesForPost({ quoteId: QUOTE_ID, imageUrls, files, scope });

  it("formats a small url inline, with the pre-fetched source, and substitutes the result", async () => {
    const fetched = source(1000);
    mocks.fetchSource.mockResolvedValue(fetched);

    const out = await run([SMALL]);

    expect(mocks.createInlineJob).toHaveBeenCalledWith({
      orgId: "org-1",
      userId: "user-1",
      quoteId: QUOTE_ID,
      sourceKind: "quote_image",
      originalUrl: SMALL,
    });
    expect(mocks.runJobInline).toHaveBeenCalledWith("job-1", fetched);
    expect(out.imageUrls).toEqual([RESULT]);
    expect(out.upscaled).toEqual([
      { originalUrl: SMALL, resultUrl: RESULT, from: { w: 1000, h: 750 }, to: { w: 1080, h: 1080 }, upscaled: true },
    ]);
    expect(out.skipped).toEqual([]);
  });

  it("crops a large image without upscaling and records upscaled:false", async () => {
    mocks.fetchSource.mockResolvedValue(source(4000, 1_000_000, 2667));
    mocks.runJobInline.mockResolvedValue(makeJob({ scale: 1, sourceWidth: 4000, sourceHeight: 2667 }));
    const out = await run([BIG]);
    expect(mocks.createInlineJob).toHaveBeenCalledTimes(1);
    expect(out.imageUrls).toEqual([RESULT]);
    expect(out.upscaled).toEqual([
      { originalUrl: BIG, resultUrl: RESULT, from: { w: 4000, h: 2667 }, to: { w: 1080, h: 1080 }, upscaled: false },
    ]);
  });

  it("leaves an exactly 1080x1080 image untouched", async () => {
    mocks.fetchSource.mockResolvedValue(source(1080, 1_000_000, 1080));
    const out = await run([BIG]);
    expect(out.imageUrls).toEqual([BIG]);
    expect(out.skipped).toEqual([{ originalUrl: BIG, reason: "already_formatted" }]);
    expect(mocks.createInlineJob).not.toHaveBeenCalled();
  });

  it("skips animated gifs", async () => {
    mocks.fetchSource.mockResolvedValue({ ...source(800), dims: { width: 800, height: 600, type: "gif" } });
    const out = await run([BIG]);
    expect(out.imageUrls).toEqual([BIG]);
    expect(out.skipped).toEqual([]);
    expect(mocks.createInlineJob).not.toHaveBeenCalled();
  });

  it("reuses a previous finished upscale without fetching anything", async () => {
    mocks.repo.findLatestDoneByOriginal.mockResolvedValue(makeJob());
    const out = await run([SMALL]);
    expect(out.imageUrls).toEqual([RESULT]);
    expect(out.skipped).toEqual([{ originalUrl: SMALL, reason: "reused_previous" }]);
    expect(mocks.fetchSource).not.toHaveBeenCalled();
    expect(mocks.createInlineJob).not.toHaveBeenCalled();
  });

  it("keeps the original and reports failed when the job fails", async () => {
    mocks.fetchSource.mockResolvedValue(source(1000));
    mocks.runJobInline.mockResolvedValue(makeJob({ status: "failed", resultUrl: null, error: "boom" }));
    const out = await run([SMALL]);
    expect(out.imageUrls).toEqual([SMALL]);
    expect(out.upscaled).toEqual([]);
    expect(out.skipped).toEqual([{ originalUrl: SMALL, reason: "failed", message: "boom" }]);
  });

  it("keeps the original and reports failed when the download throws", async () => {
    mocks.fetchSource.mockRejectedValue(new Error("403"));
    const out = await run([SMALL]);
    expect(out.imageUrls).toEqual([SMALL]);
    expect(out.skipped).toEqual([{ originalUrl: SMALL, reason: "failed", message: "403" }]);
  });

  it("keeps the original when the org is at its job cap", async () => {
    mocks.fetchSource.mockResolvedValue(source(1000));
    mocks.createInlineJob.mockResolvedValue({ kind: "cap_reached" });
    const out = await run([SMALL]);
    expect(out.imageUrls).toEqual([SMALL]);
    expect(out.skipped[0]).toMatchObject({ originalUrl: SMALL, reason: "cap_reached" });
    expect(mocks.runJobInline).not.toHaveBeenCalled();
  });

  it("formats an unknown-size image too", async () => {
    mocks.fetchSource.mockResolvedValue(source(null, 900 * 1024));
    const out = await run([SMALL]);
    expect(mocks.createInlineJob).toHaveBeenCalledTimes(1);
    expect(out.imageUrls).toEqual([RESULT]);
  });

  it("turns a file into an url and drops it from files", async () => {
    const small = makeFile("small.jpg");
    const big = makeFile("big.jpg");
    mocks.readDimensions.mockImplementation((buf: Buffer) =>
      buf === small.buffer ? { width: 800, height: 600, type: "jpg" } : { width: 1080, height: 1080, type: "jpg" },
    );
    mocks.createInlineJob.mockResolvedValue({ kind: "created", job: makeJob({ sourceKind: "upload" }) });

    const out = await run([], [small, big]);

    expect(mocks.uploadImageToS3).toHaveBeenCalledWith(small, "social-upscale/source");
    expect(mocks.createInlineJob).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKind: "upload", originalUrl: "/api/v2/files/img?key=social-upscale%2Fsource%2Fup.jpg" }),
    );
    expect(out.files).toEqual([big]);
    expect(out.imageUrls).toEqual([RESULT]);
    expect(out.upscaled[0]).toMatchObject({ originalUrl: "small.jpg", resultUrl: RESULT });
  });

  it("skips video files entirely", async () => {
    const video = makeFile("clip.mp4", "video/mp4");
    const out = await run([], [video]);
    expect(out.files).toEqual([video]);
    expect(out.skipped).toEqual([]);
    expect(mocks.readDimensions).not.toHaveBeenCalled();
    expect(mocks.createInlineJob).not.toHaveBeenCalled();
  });

  it("preserves url order with mixed outcomes", async () => {
    mocks.fetchSource.mockImplementation(async (input: { originalUrl: string }) =>
      input.originalUrl === BIG ? source(1080, 1_000_000, 1080) : source(1000),
    );
    mocks.createInlineJob.mockImplementation(async (input: { originalUrl: string }) => ({
      kind: "created",
      job: makeJob({ id: `job-${input.originalUrl}`, originalUrl: input.originalUrl }),
    }));
    mocks.runJobInline.mockImplementation(async (id: string) => makeJob({ id, resultUrl: `${id}-result` }));

    const out = await run([SMALL, BIG, SMALL_2]);

    expect(out.imageUrls).toEqual([`job-${SMALL}-result`, BIG, `job-${SMALL_2}-result`]);
  });

  it("does nothing without an organisation", async () => {
    const out = await autoUpscaleService.prepareImagesForPost({
      quoteId: QUOTE_ID,
      imageUrls: [SMALL],
      files: [],
      scope: { orgId: null },
    });
    expect(out.imageUrls).toEqual([SMALL]);
    expect(mocks.fetchSource).not.toHaveBeenCalled();
  });

  it("keeps the original and reports timeout when the budget runs out", async () => {
    vi.useFakeTimers();
    mocks.fetchSource.mockResolvedValue(source(1000));
    mocks.runJobInline.mockImplementation(() => new Promise(() => undefined)); // never finishes

    const pending = run([SMALL]);
    await vi.advanceTimersByTimeAsync(AUTO_UPSCALE_BUDGET_MS + 1);
    const out = await pending;

    expect(out.imageUrls).toEqual([SMALL]);
    expect(out.skipped).toEqual([expect.objectContaining({ originalUrl: SMALL, reason: "timeout" })]);
  });

});
