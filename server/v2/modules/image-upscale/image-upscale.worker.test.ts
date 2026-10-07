import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ImageUpscaleJob } from "@shared/schema";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  performUpscale: vi.fn(),
  replaceImageUrl: vi.fn(),
  repo: {
    claimQueued: vi.fn(),
    update: vi.fn(),
    markProcessingAsFailed: vi.fn(),
    listQueued: vi.fn(),
  },
}));

vi.mock("../../realtime/realtime.service", () => ({ realtimeService: { publish: mocks.publish } }));
vi.mock("./image-upscale.repository", () => ({ imageUpscaleRepository: mocks.repo }));
vi.mock("../quote/quote-image.service", () => ({ quoteImageService: { replaceImageUrl: mocks.replaceImageUrl } }));
vi.mock("./image-upscale.pipeline", () => ({
  createUpscalePipeline: () => ({ performUpscale: mocks.performUpscale }),
}));
vi.mock("./providers/fal-esrgan.provider", () => ({ falEsrganProvider: { upscale: vi.fn() } }));

import { createImageUpscaleWorker } from "./image-upscale.worker";
import { AppError } from "../../utils/error-handler";
import type { UpscaleProvider } from "./image-upscale.types";

const provider: UpscaleProvider = { upscale: vi.fn() };
const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const ORIGINAL = "/api/v2/files/img?key=a";
const RESULT = "/api/v2/files/img?key=out";

function makeJob(overrides: Partial<ImageUpscaleJob> = {}): ImageUpscaleJob {
  return {
    id: "job-1",
    orgId: "org-1",
    createdBy: "user-1",
    quoteId: QUOTE_ID,
    sourceKind: "quote_image",
    originalUrl: ORIGINAL,
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

const PIPELINE_RESULT = {
  url: RESULT,
  width: 3840,
  height: 2880,
  scale: 4,
  sourceWidth: 1000,
  sourceHeight: 750,
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("image upscale worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.repo.claimQueued.mockImplementation(async (id: string) => makeJob({ id, status: "processing" }));
    mocks.repo.update.mockImplementation(async (id: string, data: Partial<ImageUpscaleJob>) =>
      makeJob({ id, ...data }),
    );
    mocks.repo.markProcessingAsFailed.mockResolvedValue([]);
    mocks.repo.listQueued.mockResolvedValue([]);
    mocks.replaceImageUrl.mockResolvedValue(1);
    mocks.performUpscale.mockResolvedValue(PIPELINE_RESULT);
  });

  afterEach(() => vi.useRealTimers());

  it("claims, persists the result BEFORE swapping the quote, then marks done and emits processing + done", async () => {
    const order: string[] = [];
    mocks.repo.update.mockImplementation(async (id: string, data: Partial<ImageUpscaleJob>) => {
      order.push(`update:${Object.keys(data).sort().join(",")}`);
      return makeJob({ id, ...data });
    });
    mocks.replaceImageUrl.mockImplementation(async () => {
      order.push("replace");
      return 1;
    });

    await createImageUpscaleWorker(provider).runJob("job-1");

    expect(mocks.repo.claimQueued).toHaveBeenCalledWith("job-1");
    expect(order).toEqual([
      "update:resultHeight,resultUrl,resultWidth,scale,sourceHeight,sourceWidth",
      "replace",
      "update:replacedOnQuote",
      "update:error,finishedAt,status",
    ]);
    expect(mocks.replaceImageUrl).toHaveBeenCalledWith(QUOTE_ID, ORIGINAL, RESULT);
    expect(mocks.repo.update).toHaveBeenLastCalledWith("job-1", {
      status: "done",
      error: null,
      finishedAt: expect.any(Date),
    });
    expect(mocks.publish.mock.calls.map(([, event]) => event.job.status)).toEqual(["processing", "done"]);
  });

  it("does not run when claimQueued returns null (already taken)", async () => {
    mocks.repo.claimQueued.mockResolvedValue(null);
    await createImageUpscaleWorker(provider).runJob("job-1");
    expect(mocks.performUpscale).not.toHaveBeenCalled();
    expect(mocks.repo.update).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("does not touch the quote for an upload job", async () => {
    mocks.repo.claimQueued.mockResolvedValue(makeJob({ status: "processing", sourceKind: "upload" }));
    await createImageUpscaleWorker(provider).runJob("job-1");
    expect(mocks.replaceImageUrl).not.toHaveBeenCalled();
    expect(mocks.repo.update).toHaveBeenLastCalledWith("job-1", expect.objectContaining({ status: "done" }));
  });

  it("marks the job failed with the message of an operational error", async () => {
    mocks.performUpscale.mockRejectedValue(new AppError("Image is already 4K or larger", 400));
    await createImageUpscaleWorker(provider).runJob("job-1");
    expect(mocks.repo.update).toHaveBeenLastCalledWith(
      "job-1",
      expect.objectContaining({ status: "failed", error: "Image is already 4K or larger" }),
    );
    expect(mocks.replaceImageUrl).not.toHaveBeenCalled();
  });

  it("masks unexpected errors behind the generic message", async () => {
    mocks.performUpscale.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    await createImageUpscaleWorker(provider).runJob("job-1");
    expect(mocks.repo.update).toHaveBeenLastCalledWith(
      "job-1",
      expect.objectContaining({ status: "failed", error: "Image upscaling failed. Please try again." }),
    );
  });

  it("fails with 'Upscaled but could not update the quote' when the swap throws, keeping the stored result", async () => {
    mocks.replaceImageUrl.mockRejectedValue(new Error("db down"));
    await createImageUpscaleWorker(provider).runJob("job-1");
    const failedCall = mocks.repo.update.mock.calls.at(-1);
    expect(failedCall?.[1]).toEqual({
      status: "failed",
      error: "Upscaled but could not update the quote",
      finishedAt: expect.any(Date),
    });
    // result_url was written first and is never cleared.
    expect(mocks.repo.update.mock.calls[0][1]).toMatchObject({ resultUrl: RESULT });
    expect(failedCall?.[1]).not.toHaveProperty("resultUrl");
  });

  it("keeps result_url and replaced_on_quote (revertable) when the final done update fails", async () => {
    mocks.repo.update.mockImplementation(async (id: string, data: Partial<ImageUpscaleJob>) => {
      if (data.status === "done") throw new Error("db blip");
      return makeJob({ id, ...data, resultUrl: RESULT, replacedOnQuote: true });
    });
    await createImageUpscaleWorker(provider).runJob("job-1");

    const calls = mocks.repo.update.mock.calls.map(([, data]) => data);
    expect(calls).toContainEqual({ replacedOnQuote: true });
    const failed = calls.at(-1);
    expect(failed).toEqual({
      status: "failed",
      error: "Image upscaling failed. Please try again.",
      finishedAt: expect.any(Date),
    });
    // The failure write must not null out the result or the replaced flag.
    expect(failed).not.toHaveProperty("resultUrl");
    expect(failed).not.toHaveProperty("replacedOnQuote");
    const published = mocks.publish.mock.calls.at(-1)?.[1].job;
    expect(published).toMatchObject({ status: "failed", resultUrl: RESULT, replacedOnQuote: true });
  });

  it("an emit error cannot flip a finished job to failed", async () => {
    mocks.publish.mockImplementation(() => {
      throw new Error("bus exploded");
    });
    await createImageUpscaleWorker(provider).runJob("job-1");
    const statuses = mocks.repo.update.mock.calls.map(([, data]) => data.status).filter(Boolean);
    expect(statuses).toEqual(["done"]);
  });

  it("does not publish private (quote-less) uploads", async () => {
    mocks.repo.claimQueued.mockResolvedValue(makeJob({ status: "processing", sourceKind: "upload", quoteId: null }));
    mocks.repo.update.mockImplementation(async (id: string, data: Partial<ImageUpscaleJob>) =>
      makeJob({ id, sourceKind: "upload", quoteId: null, ...data }),
    );
    await createImageUpscaleWorker(provider).runJob("job-1");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("runs a double-enqueued id once", async () => {
    const worker = createImageUpscaleWorker(provider);
    worker.enqueue("job-1");
    worker.enqueue("job-1");
    await flush();
    expect(mocks.repo.claimQueued).toHaveBeenCalledTimes(1);
  });

  it("runs at most `concurrency` jobs at once and drains the rest", async () => {
    const releases: Array<() => void> = [];
    let running = 0;
    let peak = 0;
    mocks.performUpscale.mockImplementation(
      () =>
        new Promise((resolve) => {
          running++;
          peak = Math.max(peak, running);
          releases.push(() => {
            running--;
            resolve(PIPELINE_RESULT);
          });
        }),
    );
    const worker = createImageUpscaleWorker(provider, { concurrency: 3 });
    ["a", "b", "c", "d", "e"].forEach((id) => worker.enqueue(id));
    await flush();
    expect(running).toBe(3);

    releases.splice(0).forEach((release) => release());
    await flush();
    expect(running).toBe(2); // d and e picked up
    releases.splice(0).forEach((release) => release());
    await flush();

    expect(mocks.performUpscale).toHaveBeenCalledTimes(5);
    expect(peak).toBe(3);
  });
});

describe("image upscale worker start()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.repo.claimQueued.mockImplementation(async (id: string) => makeJob({ id, status: "processing" }));
    mocks.repo.update.mockImplementation(async (id: string, data: Partial<ImageUpscaleJob>) =>
      makeJob({ id, ...data }),
    );
    mocks.repo.markProcessingAsFailed.mockResolvedValue([]);
    mocks.repo.listQueued.mockResolvedValue([]);
    mocks.replaceImageUrl.mockResolvedValue(1);
    mocks.performUpscale.mockResolvedValue(PIPELINE_RESULT);
  });

  afterEach(() => vi.useRealTimers());

  it("fails interrupted jobs, emits them, and re-enqueues queued ones", async () => {
    mocks.repo.markProcessingAsFailed.mockResolvedValue([
      makeJob({ id: "stuck", status: "failed", error: "Server restarted" }),
    ]);
    mocks.repo.listQueued.mockResolvedValue([makeJob({ id: "q1" }), makeJob({ id: "q2" })]);
    const worker = createImageUpscaleWorker(provider);
    await worker.start();
    await flush();
    worker.stop();

    expect(mocks.repo.markProcessingAsFailed).toHaveBeenCalledWith("Server restarted");
    expect(mocks.publish.mock.calls[0][1].job).toMatchObject({ id: "stuck", status: "failed", error: "Server restarted" });
    expect(mocks.repo.claimQueued).toHaveBeenCalledWith("q1");
    expect(mocks.repo.claimQueued).toHaveBeenCalledWith("q2");
    expect(mocks.performUpscale).toHaveBeenCalledTimes(2);
  });

  it("retries boot recovery with backoff until the database answers", async () => {
    mocks.repo.markProcessingAsFailed
      .mockRejectedValueOnce(new Error("db warming up"))
      .mockRejectedValueOnce(new Error("db warming up"))
      .mockResolvedValue([]);
    mocks.repo.listQueued.mockResolvedValue([makeJob({ id: "q1" })]);
    const worker = createImageUpscaleWorker(provider, { retryDelaysMs: [0, 0, 0] });
    await worker.start();
    await flush();
    worker.stop();

    expect(mocks.repo.markProcessingAsFailed).toHaveBeenCalledTimes(3);
    expect(mocks.repo.claimQueued).toHaveBeenCalledWith("q1");
  });

  it("gives up after the last retry without throwing", async () => {
    mocks.repo.markProcessingAsFailed.mockRejectedValue(new Error("db down"));
    const worker = createImageUpscaleWorker(provider, { retryDelaysMs: [0, 0] });
    await expect(worker.start()).resolves.toBeUndefined();
    worker.stop();
    expect(mocks.repo.markProcessingAsFailed).toHaveBeenCalledTimes(3);
  });

  it("the periodic sweep enqueues queued rows whose enqueue was lost", async () => {
    vi.useFakeTimers();
    const worker = createImageUpscaleWorker(provider, { sweepIntervalMs: 60_000 });
    await worker.start();
    expect(mocks.repo.claimQueued).not.toHaveBeenCalled();

    mocks.repo.listQueued.mockResolvedValue([makeJob({ id: "lost" })]);
    await vi.advanceTimersByTimeAsync(60_000);
    worker.stop();

    expect(mocks.repo.claimQueued).toHaveBeenCalledWith("lost");
  });
});
