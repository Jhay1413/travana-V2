import { AppError } from "../../utils/error-handler";
import { s3KeyFromStoredUrl, uploadImageToS3 } from "../../utils/image-storage";
import { socialPostService } from "../social-post/social-post.service";
import { quoteImageService } from "../quote/quote-image.service";
import { imageUpscaleRepository, isUniqueViolation } from "./image-upscale.repository";
import { publishJobUpdated } from "./image-upscale.events";
import { toImageUpscaleJobDto } from "./image-upscale.mapper";
import { imageUpscaleWorker } from "./image-upscale.worker";
import { SOURCE_PREFIX, STANDALONE_SOURCE_PREFIX } from "./image-upscale.pipeline";
import type { Scope } from "../../utils/scope";
import type { ImageUpscaleJob } from "@shared/schema";
import type { CreateUpscaleJobInput, ImageUpscaleJobDto, ImageUpscaleSourceKind } from "./image-upscale.types";

// Sized so a whole quote's gallery can be queued at once.
export const MAX_ACTIVE_JOBS_PER_ORG = 30;
const DEFAULT_RECENT_LIMIT = 10;

export interface InsertJobInput {
  orgId: string;
  userId: string | null;
  quoteId: string | null;
  sourceKind: ImageUpscaleSourceKind;
  originalUrl: string;
}

export type InsertJobOutcome =
  | { kind: "created" | "duplicate"; job: ImageUpscaleJob }
  | { kind: "cap_reached" };

interface JobWorker {
  enqueue(jobId: string): void;
}

/** A platform admin who is not acting inside an organisation has no tenant to scope jobs to. */
function assertOrg(scope: Scope): string {
  if (!scope.orgId) throw new AppError("Select an organisation to use the upscaler", 403);
  return scope.orgId;
}

export function createImageUpscaleService(worker: JobWorker) {
  /** Validates the request and returns the url + kind to store on the job row. */
  async function resolveSource(
    input: CreateUpscaleJobInput,
    scope: Scope,
  ): Promise<{ originalUrl: string; sourceKind: ImageUpscaleSourceKind }> {
    if (input.file) {
      // When a quote is given, validate it is in scope before storing anything.
      if (input.quoteId) await socialPostService.getQuoteImages(input.quoteId, scope);
      const storedUrl = await uploadImageToS3(input.file, input.quoteId ? SOURCE_PREFIX : STANDALONE_SOURCE_PREFIX);
      if (!s3KeyFromStoredUrl(storedUrl)) throw new AppError("Failed to store source image", 500);
      return { originalUrl: storedUrl, sourceKind: "upload" };
    }
    if (!input.imageUrl) throw new AppError("Provide an imageUrl or a file", 400);
    if (!input.quoteId) throw new AppError("quoteId is required when using imageUrl", 400);

    const quoteImages = await socialPostService.getQuoteImages(input.quoteId, scope);
    if (!quoteImages.some((img) => img.url === input.imageUrl)) {
      throw new AppError("Image does not belong to this quote", 400);
    }
    return { originalUrl: input.imageUrl, sourceKind: "quote_image" };
  }

  async function insertJob(input: InsertJobInput): Promise<InsertJobOutcome> {
    const { orgId, userId, quoteId, sourceKind, originalUrl } = input;
    const quoteImage = sourceKind === "quote_image" && quoteId ? quoteId : null;

    if (quoteImage) {
      const duplicate = await imageUpscaleRepository.findActiveDuplicate(quoteImage, originalUrl, orgId);
      if (duplicate) return { kind: "duplicate", job: duplicate };
    }

    let job: ImageUpscaleJob | null;
    try {
      job = await imageUpscaleRepository.insertIfUnderCap(
        { orgId, createdBy: userId, quoteId, sourceKind, originalUrl, status: "queued" },
        MAX_ACTIVE_JOBS_PER_ORG,
      );
    } catch (err) {
      // Lost a race with another request for the same image (partial unique index).
      if (quoteImage && isUniqueViolation(err)) {
        const winner = await imageUpscaleRepository.findActiveDuplicate(quoteImage, originalUrl, orgId);
        if (winner) return { kind: "duplicate", job: winner };
      }
      throw err;
    }
    if (!job) return { kind: "cap_reached" };
    return { kind: "created", job };
  }

  async function loadScopedJob(jobId: string, scope: Scope) {
    const job = await imageUpscaleRepository.findById(jobId, assertOrg(scope));
    if (!job) throw new AppError("Upscale job not found", 404);
    return job;
  }

  return {
    async createJob(input: CreateUpscaleJobInput, scope: Scope): Promise<ImageUpscaleJobDto> {
      // Before any S3 write: without an org there is nothing to scope the job to.
      const orgId = assertOrg(scope);
      const { originalUrl, sourceKind } = await resolveSource(input, scope);
      const outcome = await insertJob({
        orgId,
        userId: scope.userId,
        quoteId: input.quoteId ?? null,
        sourceKind,
        originalUrl,
      });
      if (outcome.kind === "cap_reached") throw new AppError("Too many upscales in progress, try again shortly", 429);
      if (outcome.kind === "created") worker.enqueue(outcome.job.id);
      return toImageUpscaleJobDto(outcome.job);
    },

    /**
     * Creates the job row for the caller to run itself (auto-upscale at schedule
     * time) — same cap and duplicate rules as `createJob`, but nothing is enqueued
     * and no request scope / quote-membership check is applied (the caller has
     * already validated the quote).
     */
    createInlineJob: insertJob,

    async getJob(jobId: string, scope: Scope): Promise<ImageUpscaleJobDto> {
      return toImageUpscaleJobDto(await loadScopedJob(jobId, scope));
    },

    async listJobsForQuote(quoteId: string, scope: Scope): Promise<ImageUpscaleJobDto[]> {
      const orgId = assertOrg(scope);
      // Rejects a quote outside this organisation (org scoping).
      await socialPostService.getQuoteImages(quoteId, scope);
      const jobs = await imageUpscaleRepository.listByQuote(quoteId, orgId);
      return jobs.map(toImageUpscaleJobDto);
    },

    async listMyRecentJobs(scope: Scope, limit = DEFAULT_RECENT_LIMIT): Promise<ImageUpscaleJobDto[]> {
      const orgId = assertOrg(scope);
      if (!scope.userId) return [];
      const jobs = await imageUpscaleRepository.listRecentForUser(scope.userId, orgId, limit);
      return jobs.map(toImageUpscaleJobDto);
    },

    /** Swaps the quote image back to the job's remembered original url. */
    async revertJob(jobId: string, scope: Scope): Promise<{ reverted: boolean; job: ImageUpscaleJobDto }> {
      const job = await loadScopedJob(jobId, scope);
      if (job.status === "queued" || job.status === "processing") {
        throw new AppError("This upscale is still in progress", 409);
      }
      // A job that failed AFTER swapping the quote (replacedOnQuote) is still revertable.
      if (!job.replacedOnQuote || !job.resultUrl || !job.quoteId) {
        throw new AppError("This upscale was not applied to a quote image", 400);
      }
      if (job.revertedAt) throw new AppError("This upscale was already reverted", 400);

      // Rejects a quote outside this organisation (org scoping).
      await socialPostService.getQuoteImages(job.quoteId, scope);
      const changed = await quoteImageService.replaceImageUrl(job.quoteId, job.resultUrl, job.originalUrl);

      const updated = await imageUpscaleRepository.update(job.id, { revertedAt: new Date() });
      const dto = toImageUpscaleJobDto(updated ?? { ...job, revertedAt: new Date() });
      if (updated) publishJobUpdated(updated);
      return { reverted: changed > 0, job: dto };
    },
  };
}

// Resolved per call: the worker module sits in an import cycle with this one (via social-post).
export const imageUpscaleService = createImageUpscaleService({
  enqueue: (jobId) => imageUpscaleWorker.enqueue(jobId),
});
