import { uploadImageToS3 } from "../../utils/image-storage";
import { imageUpscaleRepository } from "./image-upscale.repository";
import { imageUpscaleService } from "./image-upscale.service";
import { imageUpscaleWorker } from "./image-upscale.worker";
import { SOURCE_PREFIX, fetchSourceForUpscale, readDimensions } from "./image-upscale.pipeline";
import { POST_IMAGE_SIZE } from "./image-upscale.types";
import type { ImageUpscaleJob } from "@shared/schema";
import type {
  AutoUpscaleItem,
  AutoUpscaleSize,
  AutoUpscaleSkip,
  FetchedSource,
  ImageDims,
  ImageUpscaleSourceKind,
  PrepareImagesInput,
  PrepareImagesResult,
} from "./image-upscale.types";

/** Overall wall-clock budget for the whole batch; whatever is unfinished keeps its original. */
export const AUTO_UPSCALE_BUDGET_MS = 150_000;
export const AUTO_UPSCALE_CONCURRENCY = 3;
/** What happened to one image. */
type ItemOutcome =
  | { kind: "upscaled"; item: AutoUpscaleItem }
  | { kind: "reused"; url: string; skip: AutoUpscaleSkip }
  | { kind: "kept"; skip?: AutoUpscaleSkip };

interface ImageTask {
  label: string;
  /** The uploaded file behind this task; null for a quote image url. */
  file: Express.Multer.File | null;
  run: () => Promise<ItemOutcome>;
}

class BudgetExceeded extends Error {}

/** Exactly the post format already: nothing to do. */
function isAlreadyFormatted(dims: ImageDims | null): boolean {
  return dims?.width === POST_IMAGE_SIZE && dims.height === POST_IMAGE_SIZE;
}

function size(w: number | null | undefined, h: number | null | undefined): AutoUpscaleSize | null {
  return w && h ? { w, h } : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

/** Animated gifs would be flattened by the formatter, so they are left alone. */
function isGif(dims: ImageDims | null): boolean {
  return dims?.type === "gif";
}

/** Rejects with `BudgetExceeded` once the deadline passes; the timer is always cleared. */
async function withDeadline<T>(work: Promise<T>, deadline: number): Promise<T> {
  // A late rejection after we stopped waiting must not surface as unhandled.
  work.catch(() => undefined);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new BudgetExceeded("Format budget exceeded");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BudgetExceeded("Format budget exceeded")), remaining);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Runs `fn` over `items` with at most `limit` in flight; settled results keep input order. */
async function settleWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      const [settled] = await Promise.allSettled([fn(items[i])]);
      results[i] = settled;
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

function toItem(job: ImageUpscaleJob, label: string, measured: ImageDims | null): AutoUpscaleItem | null {
  if (!job.resultUrl) return null;
  return {
    originalUrl: label,
    resultUrl: job.resultUrl,
    from: size(job.sourceWidth, job.sourceHeight) ?? size(measured?.width, measured?.height),
    to: size(job.resultWidth, job.resultHeight),
    // scale 1 = crop-only (no provider call).
    upscaled: (job.scale ?? 1) > 1,
  };
}

export const autoUpscaleService = {
  /**
   * Formats every selected image to the `POST_IMAGE_SIZE` square so that copy is
   * what gets posted (small images are upscaled first, large ones only cropped).
   * Never throws: an image that cannot be formatted keeps its original and is
   * reported in `skipped`. The quote's own images are never changed.
   *
   * Per quote image: a finished job for it exists -> use that; otherwise download +
   * measure; GIF or already exactly square 1080 -> keep; else run a job inline.
   * Per uploaded image file: same, storing the file first and posting the result by url.
   */
  async prepareImagesForPost(input: PrepareImagesInput): Promise<PrepareImagesResult> {
    const { quoteId, scope } = input;
    const scopeOrgId = scope.orgId;
    // Jobs are tenant rows: without an organisation there is nothing to attach them to.
    if (!scopeOrgId) return { imageUrls: input.imageUrls, files: input.files, upscaled: [], skipped: [] };

    const tenantId: string = scopeOrgId;
    const userId = scope.userId ?? null;
    const startedAt = Date.now();
    const deadline = startedAt + AUTO_UPSCALE_BUDGET_MS;

    /** Creates the job, runs it inline and maps the finished row to an outcome. */
    async function runInline(
      sourceKind: ImageUpscaleSourceKind,
      originalUrl: string,
      label: string,
      source: FetchedSource | undefined,
    ): Promise<ItemOutcome> {
      const created = await imageUpscaleService.createInlineJob({ orgId: tenantId, userId, quoteId, sourceKind, originalUrl });
      if (created.kind === "cap_reached") {
        return { kind: "kept", skip: { originalUrl: label, reason: "cap_reached", message: "Too many images in progress" } };
      }
      if (created.kind === "duplicate") {
        // Another request already owns this image's job; it cannot be run from here.
        return { kind: "kept", skip: { originalUrl: label, reason: "failed", message: "Already being formatted" } };
      }
      const finished = await imageUpscaleWorker.runJobInline(created.job.id, source);
      const item = finished?.status === "done" ? toItem(finished, label, source?.dims ?? null) : null;
      if (item) return { kind: "upscaled", item };
      return {
        kind: "kept",
        skip: { originalUrl: label, reason: "failed", message: finished?.error ?? "Formatting did not complete" },
      };
    }

    async function handleUrl(url: string): Promise<ItemOutcome> {
      const previous = await imageUpscaleRepository.findLatestDoneByOriginal(quoteId, url, tenantId);
      if (previous?.resultUrl && previous.resultWidth === POST_IMAGE_SIZE && previous.resultHeight === POST_IMAGE_SIZE) {
        return { kind: "reused", url: previous.resultUrl, skip: { originalUrl: url, reason: "reused_previous" } };
      }

      const source = await fetchSourceForUpscale({ originalUrl: url, sourceKind: "quote_image" });
      if (isGif(source.dims)) return { kind: "kept" };
      if (isAlreadyFormatted(source.dims)) {
        return { kind: "kept", skip: { originalUrl: url, reason: "already_formatted" } };
      }
      return runInline("quote_image", url, url, source);
    }

    async function handleFile(file: Express.Multer.File): Promise<ItemOutcome> {
      const dims = readDimensions(file.buffer);
      if (isGif(dims)) return { kind: "kept" };
      if (isAlreadyFormatted(dims)) {
        return { kind: "kept", skip: { originalUrl: file.originalname, reason: "already_formatted" } };
      }
      // The pipeline reads uploads back from our S3, so the original goes there first.
      const storedUrl = await uploadImageToS3(file, SOURCE_PREFIX);
      return runInline("upload", storedUrl, file.originalname, undefined);
    }

    // Videos and other non-images never enter the upscale path.
    const tasks: ImageTask[] = [
      ...input.files
        .filter((file) => file.mimetype.startsWith("image/"))
        .map((file): ImageTask => ({ label: file.originalname, file, run: () => handleFile(file) })),
      ...input.imageUrls.map((url): ImageTask => ({ label: url, file: null, run: () => handleUrl(url) })),
    ];

    const settled = await settleWithConcurrency(tasks, AUTO_UPSCALE_CONCURRENCY, async (task): Promise<ItemOutcome> => {
      try {
        return await withDeadline(task.run(), deadline);
      } catch (err) {
        if (err instanceof BudgetExceeded) {
          return { kind: "kept", skip: { originalUrl: task.label, reason: "timeout", message: "Formatting took too long" } };
        }
        console.error(`[SocialPost][autoUpscale] ${task.label} failed:`, errorMessage(err));
        return { kind: "kept", skip: { originalUrl: task.label, reason: "failed", message: errorMessage(err) } };
      }
    });

    const upscaled: AutoUpscaleItem[] = [];
    const skipped: AutoUpscaleSkip[] = [];
    // Files that became urls go first: OnlySocials uploads files before urls.
    const fileDerivedUrls: string[] = [];
    const urls: string[] = [];
    const upscaledFiles = new Set<Express.Multer.File>();

    tasks.forEach((task, i) => {
      const result = settled[i];
      const outcome: ItemOutcome =
        result.status === "fulfilled" ? result.value : { kind: "kept", skip: { originalUrl: task.label, reason: "failed" } };
      if (outcome.kind === "upscaled") upscaled.push(outcome.item);
      else if (outcome.skip) skipped.push(outcome.skip);

      if (task.file) {
        if (outcome.kind === "upscaled") {
          fileDerivedUrls.push(outcome.item.resultUrl);
          upscaledFiles.add(task.file);
        }
        return;
      }
      if (outcome.kind === "upscaled") urls.push(outcome.item.resultUrl);
      else if (outcome.kind === "reused") urls.push(outcome.url);
      else urls.push(task.label);
    });

    console.log(
      `[SocialPost][timing] autoUpscale: ${upscaled.length} formatted, ${skipped.length} skipped of ${tasks.length} in ${Date.now() - startedAt}ms`,
    );

    return {
      imageUrls: [...fileDerivedUrls, ...urls],
      files: input.files.filter((file) => !upscaledFiles.has(file)),
      upscaled,
      skipped,
    };
  },
};
