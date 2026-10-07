import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImageUpscaleJob } from "@shared/schema";

const mocks = vi.hoisted(() => ({
  getQuoteImages: vi.fn(),
  uploadImageToS3: vi.fn(),
  replaceImageUrl: vi.fn(),
  publish: vi.fn(),
  repo: {
    insertIfUnderCap: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    listByQuote: vi.fn(),
    listRecentForUser: vi.fn(),
    findActiveDuplicate: vi.fn(),
  },
}));

vi.mock("../social-post/social-post.service", () => ({
  socialPostService: { getQuoteImages: mocks.getQuoteImages },
}));
vi.mock("../../utils/image-storage", () => ({
  uploadImageToS3: mocks.uploadImageToS3,
  s3KeyFromStoredUrl: (url: string) =>
    url.startsWith("/api/v2/files/img?key=") ? decodeURIComponent(url.split("key=")[1]) : null,
}));
vi.mock("../quote/quote-image.service", () => ({ quoteImageService: { replaceImageUrl: mocks.replaceImageUrl } }));
vi.mock("../../realtime/realtime.service", () => ({ realtimeService: { publish: mocks.publish } }));
vi.mock("./image-upscale.repository", () => ({
  imageUpscaleRepository: mocks.repo,
  isUniqueViolation: (err: unknown) => (err as { code?: string } | null)?.code === "23505",
}));
// The service module builds its singleton from the worker; the worker is not under test here.
vi.mock("./image-upscale.worker", () => ({ imageUpscaleWorker: { enqueue: vi.fn() } }));
vi.mock("./image-upscale.pipeline", () => ({
  SOURCE_PREFIX: "social-upscale/source",
  STANDALONE_SOURCE_PREFIX: "image-upscale/source",
}));

import { createImageUpscaleService, MAX_ACTIVE_JOBS_PER_ORG } from "./image-upscale.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const scope: Scope = { orgId: "org-1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "user-1" };
const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const IMG = "/api/v2/files/img?key=quotes%2Fa.jpg";
const RESULT = "/api/v2/files/img?key=social-upscale%2Fout.jpg";

function makeJob(overrides: Partial<ImageUpscaleJob> = {}): ImageUpscaleJob {
  return {
    id: "job-1",
    orgId: "org-1",
    createdBy: "user-1",
    quoteId: QUOTE_ID,
    sourceKind: "quote_image",
    originalUrl: IMG,
    resultUrl: null,
    status: "queued",
    error: null,
    scale: null,
    sourceWidth: null,
    sourceHeight: null,
    resultWidth: null,
    resultHeight: null,
    replacedOnQuote: false,
    revertedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

const worker = { enqueue: vi.fn() };

describe("imageUpscaleService.createJob", () => {
  const service = createImageUpscaleService(worker);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuoteImages.mockResolvedValue([{ url: IMG, name: "a", source: "quote", isPrimary: true }]);
    mocks.repo.findActiveDuplicate.mockResolvedValue(null);
    mocks.repo.insertIfUnderCap.mockImplementation(async (data: Partial<ImageUpscaleJob>) => makeJob(data));
  });

  it("rejects an imageUrl that is not one of the quote's images", async () => {
    await expect(
      service.createJob({ quoteId: QUOTE_ID, imageUrl: "http://169.254.169.254/x.png" }, scope),
    ).rejects.toMatchObject({ statusCode: 400, message: "Image does not belong to this quote" });
    expect(mocks.repo.insertIfUnderCap).not.toHaveBeenCalled();
    expect(worker.enqueue).not.toHaveBeenCalled();
  });

  it("rejects an imageUrl without a quoteId", async () => {
    await expect(service.createJob({ imageUrl: IMG }, scope)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a request with neither imageUrl nor file", async () => {
    await expect(service.createJob({ quoteId: QUOTE_ID }, scope)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("inserts a queued job, enqueues it and returns the DTO", async () => {
    const dto = await service.createJob({ quoteId: QUOTE_ID, imageUrl: IMG }, scope);
    expect(mocks.repo.insertIfUnderCap).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        createdBy: "user-1",
        quoteId: QUOTE_ID,
        sourceKind: "quote_image",
        originalUrl: IMG,
        status: "queued",
      }),
      MAX_ACTIVE_JOBS_PER_ORG,
    );
    expect(worker.enqueue).toHaveBeenCalledWith("job-1");
    expect(dto).toMatchObject({ id: "job-1", status: "queued", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("returns the existing active duplicate instead of creating another job", async () => {
    mocks.repo.findActiveDuplicate.mockResolvedValue(makeJob({ id: "job-existing", status: "processing" }));
    const dto = await service.createJob({ quoteId: QUOTE_ID, imageUrl: IMG }, scope);
    expect(dto.id).toBe("job-existing");
    expect(mocks.repo.insertIfUnderCap).not.toHaveBeenCalled();
    expect(worker.enqueue).not.toHaveBeenCalled();
  });

  it("rejects with 429 when the org already has too many active jobs", async () => {
    mocks.repo.insertIfUnderCap.mockResolvedValue(null);
    await expect(service.createJob({ quoteId: QUOTE_ID, imageUrl: IMG }, scope)).rejects.toMatchObject({
      statusCode: 429,
      message: "Too many upscales in progress, try again shortly",
    });
    expect(worker.enqueue).not.toHaveBeenCalled();
  });

  it("returns the winner when the partial unique index rejects a racing duplicate (23505)", async () => {
    mocks.repo.findActiveDuplicate
      .mockResolvedValueOnce(null) // pre-check: nothing yet
      .mockResolvedValueOnce(makeJob({ id: "job-winner", status: "queued" }));
    mocks.repo.insertIfUnderCap.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));
    const dto = await service.createJob({ quoteId: QUOTE_ID, imageUrl: IMG }, scope);
    expect(dto.id).toBe("job-winner");
    expect(worker.enqueue).not.toHaveBeenCalled();
  });

  it("rethrows non-unique database errors", async () => {
    mocks.repo.insertIfUnderCap.mockRejectedValue(new Error("connection lost"));
    await expect(service.createJob({ quoteId: QUOTE_ID, imageUrl: IMG }, scope)).rejects.toThrow("connection lost");
  });

  it("rejects a quote from another organisation (getQuoteImages throws) without creating anything", async () => {
    mocks.getQuoteImages.mockRejectedValue(new AppError("Quote not found", 404));
    await expect(service.createJob({ quoteId: QUOTE_ID, imageUrl: IMG }, scope)).rejects.toMatchObject({ statusCode: 404 });
    const file = { originalname: "x.jpg", mimetype: "image/jpeg", buffer: Buffer.from("x") } as Express.Multer.File;
    await expect(service.createJob({ quoteId: QUOTE_ID, file }, scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.uploadImageToS3).not.toHaveBeenCalled();
    expect(mocks.repo.insertIfUnderCap).not.toHaveBeenCalled();
  });

  it("403s without an organisation BEFORE uploading anything to S3", async () => {
    const noOrg: Scope = { ...scope, orgId: "" };
    const file = { originalname: "x.jpg", mimetype: "image/jpeg", buffer: Buffer.from("x") } as Express.Multer.File;
    await expect(service.createJob({ file }, noOrg)).rejects.toMatchObject({
      statusCode: 403,
      message: "Select an organisation to use the upscaler",
    });
    expect(mocks.uploadImageToS3).not.toHaveBeenCalled();
    expect(mocks.repo.insertIfUnderCap).not.toHaveBeenCalled();
  });

  it("stores a picked file under social-upscale/source and creates an upload job (no replace)", async () => {
    mocks.uploadImageToS3.mockResolvedValue("/api/v2/files/img?key=social-upscale%2Fsource%2Fx.jpg");
    const file = { originalname: "x.jpg", mimetype: "image/jpeg", buffer: Buffer.from("x") } as Express.Multer.File;
    await service.createJob({ quoteId: QUOTE_ID, file }, scope);
    expect(mocks.getQuoteImages).toHaveBeenCalledWith(QUOTE_ID, scope);
    expect(mocks.uploadImageToS3).toHaveBeenCalledWith(file, "social-upscale/source");
    expect(mocks.repo.findActiveDuplicate).not.toHaveBeenCalled();
    expect(mocks.repo.insertIfUnderCap).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: "upload",
        quoteId: QUOTE_ID,
        originalUrl: "/api/v2/files/img?key=social-upscale%2Fsource%2Fx.jpg",
      }),
      MAX_ACTIVE_JOBS_PER_ORG,
    );
  });

  it("creates a standalone upload job without a quote under image-upscale/source", async () => {
    mocks.uploadImageToS3.mockResolvedValue("/api/v2/files/img?key=image-upscale%2Fsource%2Fx.jpg");
    const file = { originalname: "x.jpg", mimetype: "image/jpeg", buffer: Buffer.from("x") } as Express.Multer.File;
    await service.createJob({ file }, scope);
    expect(mocks.getQuoteImages).not.toHaveBeenCalled();
    expect(mocks.uploadImageToS3).toHaveBeenCalledWith(file, "image-upscale/source");
    expect(mocks.repo.insertIfUnderCap).toHaveBeenCalledWith(expect.objectContaining({ quoteId: null, sourceKind: "upload" }), MAX_ACTIVE_JOBS_PER_ORG);
  });
});

describe("imageUpscaleService reads", () => {
  const service = createImageUpscaleService(worker);

  beforeEach(() => vi.clearAllMocks());

  it("getJob is org-scoped and 404s when not found", async () => {
    mocks.repo.findById.mockResolvedValue(null);
    await expect(service.getJob("job-1", scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.repo.findById).toHaveBeenCalledWith("job-1", "org-1");
  });

  it("listJobsForQuote checks quote access then lists by org", async () => {
    mocks.getQuoteImages.mockResolvedValue([]);
    mocks.repo.listByQuote.mockResolvedValue([makeJob()]);
    const jobs = await service.listJobsForQuote(QUOTE_ID, scope);
    expect(mocks.getQuoteImages).toHaveBeenCalledWith(QUOTE_ID, scope);
    expect(mocks.repo.listByQuote).toHaveBeenCalledWith(QUOTE_ID, "org-1");
    expect(jobs).toHaveLength(1);
  });

  it("every read and revert 403s without an organisation", async () => {
    const noOrg: Scope = { ...scope, orgId: "" };
    await expect(service.getJob("job-1", noOrg)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.listJobsForQuote(QUOTE_ID, noOrg)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.listMyRecentJobs(noOrg)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.revertJob("job-1", noOrg)).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.repo.findById).not.toHaveBeenCalled();
  });

  it("listJobsForQuote rejects a foreign quote before listing", async () => {
    mocks.getQuoteImages.mockRejectedValue(new AppError("Quote not found", 404));
    await expect(service.listJobsForQuote(QUOTE_ID, scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.repo.listByQuote).not.toHaveBeenCalled();
  });

  it("listMyRecentJobs defaults to 10 for the current user", async () => {
    mocks.repo.listRecentForUser.mockResolvedValue([makeJob()]);
    await service.listMyRecentJobs(scope);
    expect(mocks.repo.listRecentForUser).toHaveBeenCalledWith("user-1", "org-1", 10);
  });
});

describe("imageUpscaleService.revertJob", () => {
  const service = createImageUpscaleService(worker);
  const done = (overrides: Partial<ImageUpscaleJob> = {}) =>
    makeJob({ status: "done", resultUrl: RESULT, replacedOnQuote: true, ...overrides });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuoteImages.mockResolvedValue([]);
    mocks.replaceImageUrl.mockResolvedValue(1);
    mocks.repo.update.mockImplementation(async (_id: string, data: Partial<ImageUpscaleJob>) => done(data));
  });

  it("404s for a job outside the org / unknown id", async () => {
    mocks.repo.findById.mockResolvedValue(null);
    await expect(service.revertJob("nope", scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.replaceImageUrl).not.toHaveBeenCalled();
  });

  it("409s while the job is still in flight, 400s when it was never applied to the quote", async () => {
    mocks.repo.findById.mockResolvedValueOnce(makeJob({ status: "processing" }));
    await expect(service.revertJob("job-1", scope)).rejects.toMatchObject({ statusCode: 409 });
    mocks.repo.findById.mockResolvedValueOnce(done({ replacedOnQuote: false }));
    await expect(service.revertJob("job-1", scope)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.replaceImageUrl).not.toHaveBeenCalled();
  });

  it("400s when already reverted", async () => {
    mocks.repo.findById.mockResolvedValue(done({ revertedAt: new Date() }));
    await expect(service.revertJob("job-1", scope)).rejects.toMatchObject({
      statusCode: 400,
      message: "This upscale was already reverted",
    });
    expect(mocks.replaceImageUrl).not.toHaveBeenCalled();
  });

  it("rejects reverting when the quote belongs to another organisation", async () => {
    mocks.repo.findById.mockResolvedValue(done());
    mocks.getQuoteImages.mockRejectedValue(new AppError("Quote not found", 404));
    await expect(service.revertJob("job-1", scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.replaceImageUrl).not.toHaveBeenCalled();
  });

  it("can still revert a job that failed after the quote was swapped", async () => {
    mocks.repo.findById.mockResolvedValue(done({ status: "failed", error: "boom" }));
    const result = await service.revertJob("job-1", scope);
    expect(mocks.replaceImageUrl).toHaveBeenCalledWith(QUOTE_ID, RESULT, IMG);
    expect(result.reverted).toBe(true);
  });

  it("swaps the result back to the remembered original, marks reverted and emits an event", async () => {
    mocks.repo.findById.mockResolvedValue(done());
    const result = await service.revertJob("job-1", scope);
    expect(mocks.replaceImageUrl).toHaveBeenCalledWith(QUOTE_ID, RESULT, IMG);
    expect(mocks.repo.update).toHaveBeenCalledWith("job-1", { revertedAt: expect.any(Date) });
    expect(result.reverted).toBe(true);
    expect(result.job.revertedAt).not.toBeNull();
    expect(mocks.publish).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ type: "upscale.job.updated", orgId: "org-1" }),
    );
  });
});
