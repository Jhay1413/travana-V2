import { AppError } from "../../utils/error-handler";
import { quoteImageService } from "../quote/quote-image.service";
import { imageUpscaleRepository } from "./image-upscale.repository";
import { publishJobUpdated } from "./image-upscale.events";
import { createUpscalePipeline } from "./image-upscale.pipeline";
import { falEsrganProvider } from "./providers/fal-esrgan.provider";
import type { ImageUpscaleJob } from "@shared/schema";
import type { UpscaleProvider } from "./image-upscale.types";

export const IMAGE_UPSCALE_CONCURRENCY = 3;
const SWEEP_INTERVAL_MS = 60_000;
const START_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];
const GENERIC_FAILURE = "Image upscaling failed. Please try again.";
const QUOTE_UPDATE_FAILURE = "Upscaled but could not update the quote";

interface WorkerOptions {
  concurrency?: number;
  /** One entry per retry of boot recovery (the first attempt is immediate). */
  retryDelaysMs?: number[];
  sweepIntervalMs?: number;
}

/** Operational AppErrors carry a user-safe message; anything else is masked. */
function failureMessage(err: unknown): string {
  return err instanceof AppError && err.isOperational ? err.message : GENERIC_FAILURE;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * In-process job queue (single Node process — no Redis). Jobs are persisted in
 * Postgres; this only decides when they run. `start()` rebuilds the queue after
 * a restart and a periodic sweep re-queues any `queued` row whose enqueue was lost.
 */
export function createImageUpscaleWorker(provider: UpscaleProvider, options: WorkerOptions = {}) {
  const concurrency = options.concurrency ?? IMAGE_UPSCALE_CONCURRENCY;
  const retryDelaysMs = options.retryDelaysMs ?? START_RETRY_DELAYS_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
  const pipeline = createUpscalePipeline(provider);
  const pending: string[] = [];
  // Ids that are waiting OR running, so a double enqueue (request + sweep) runs once.
  const known = new Set<string>();
  let running = 0;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  /** Runs the pipeline and the follow-up writes. Resolves to the final row to publish; never throws. */
  async function execute(job: ImageUpscaleJob): Promise<ImageUpscaleJob | null> {
    try {
      const result = await pipeline.performUpscale({
        originalUrl: job.originalUrl,
        sourceKind: job.sourceKind,
        quoteId: job.quoteId,
        orgId: job.orgId,
        userId: job.createdBy,
      });

      // Persist the result BEFORE touching the quote: from here on a late
      // failure can never lose the upscaled image or strand a swapped quote.
      await imageUpscaleRepository.update(job.id, {
        resultUrl: result.url,
        scale: result.scale,
        sourceWidth: result.sourceWidth,
        sourceHeight: result.sourceHeight,
        resultWidth: result.width,
        resultHeight: result.height,
      });

      if (job.quoteId && job.sourceKind === "quote_image") {
        // The original S3 object is kept (it may be shared with duplicated quotes).
        let changed: number;
        try {
          changed = await quoteImageService.replaceImageUrl(job.quoteId, job.originalUrl, result.url);
        } catch (err) {
          console.error(`[ImageUpscale] job ${job.id} could not update the quote:`, err);
          return await imageUpscaleRepository.update(job.id, {
            status: "failed",
            error: QUOTE_UPDATE_FAILURE,
            finishedAt: new Date(),
          });
        }
        // Recorded right away so revert works even if the final update below fails.
        if (changed > 0) await imageUpscaleRepository.update(job.id, { replacedOnQuote: true });
      }

      return await imageUpscaleRepository.update(job.id, { status: "done", error: null, finishedAt: new Date() });
    } catch (err) {
      console.error(`[ImageUpscale] job ${job.id} failed:`, err instanceof Error ? err.message : err);
      try {
        // Only status/error/finishedAt: result_url and replaced_on_quote already
        // persisted (if any) are kept so the image can still be reverted.
        return await imageUpscaleRepository.update(job.id, {
          status: "failed",
          error: failureMessage(err),
          finishedAt: new Date(),
        });
      } catch (updateErr) {
        console.error(`[ImageUpscale] job ${job.id} could not be marked failed:`, updateErr);
        return null;
      }
    }
  }

  async function runJob(jobId: string): Promise<void> {
    let claimed: ImageUpscaleJob | null;
    try {
      claimed = await imageUpscaleRepository.claimQueued(jobId);
    } catch (err) {
      console.error(`[ImageUpscale] job ${jobId} could not be claimed:`, err);
      return;
    }
    if (!claimed) return; // already taken, finished, or gone
    publishJobUpdated(claimed);

    const finished = await execute(claimed);
    if (finished) publishJobUpdated(finished);
  }

  function pump(): void {
    while (running < concurrency && pending.length > 0) {
      const jobId = pending.shift();
      if (!jobId) break;
      running++;
      void runJob(jobId).finally(() => {
        running--;
        known.delete(jobId);
        pump();
      });
    }
  }

  function enqueue(jobId: string): void {
    if (known.has(jobId)) return;
    known.add(jobId);
    pending.push(jobId);
    pump();
  }

  async function enqueueQueuedRows(): Promise<void> {
    const queued = await imageUpscaleRepository.listQueued();
    queued.forEach((job) => enqueue(job.id));
  }

  async function recoverOnBoot(): Promise<void> {
    const interrupted = await imageUpscaleRepository.markProcessingAsFailed("Server restarted");
    interrupted.forEach(publishJobUpdated);
    await enqueueQueuedRows();
  }

  return {
    runJob,
    enqueue,

    /**
     * Boot recovery (fail what the dead process was running, re-queue what it
     * never started), retried with backoff since the DB may still be warming up,
     * then a periodic sweep for `queued` rows whose enqueue got lost.
     */
    async start(): Promise<void> {
      for (let attempt = 0; ; attempt++) {
        try {
          await recoverOnBoot();
          break;
        } catch (err) {
          const delay = retryDelaysMs[attempt];
          if (delay === undefined) {
            console.error("[ImageUpscale] boot recovery gave up:", err);
            break;
          }
          console.error(`[ImageUpscale] boot recovery failed, retrying in ${delay}ms:`, err);
          await sleep(delay);
        }
      }
      if (!sweepTimer) {
        sweepTimer = setInterval(() => {
          enqueueQueuedRows().catch((err) => console.error("[ImageUpscale] sweep failed:", err));
        }, sweepIntervalMs);
        // Never keep the process alive just for the sweep.
        sweepTimer.unref();
      }
    },

    stop(): void {
      if (sweepTimer) clearInterval(sweepTimer);
      sweepTimer = null;
    },
  };
}

export const imageUpscaleWorker = createImageUpscaleWorker(falEsrganProvider);

export function startImageUpscaleWorker(): void {
  imageUpscaleWorker.start().catch((err) => console.error("[ImageUpscale] worker start failed:", err));
}
