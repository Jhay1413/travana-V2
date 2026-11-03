import type { ImageUpscaleJob } from "@shared/schema";
import type { ImageUpscaleJobDto } from "./image-upscale.types";

export function toImageUpscaleJobDto(job: ImageUpscaleJob): ImageUpscaleJobDto {
  return {
    id: job.id,
    quoteId: job.quoteId,
    sourceKind: job.sourceKind,
    originalUrl: job.originalUrl,
    resultUrl: job.resultUrl,
    status: job.status,
    error: job.error,
    scale: job.scale,
    sourceWidth: job.sourceWidth,
    sourceHeight: job.sourceHeight,
    resultWidth: job.resultWidth,
    resultHeight: job.resultHeight,
    replacedOnQuote: job.replacedOnQuote,
    revertedAt: job.revertedAt ? job.revertedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  };
}
