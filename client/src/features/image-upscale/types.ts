export interface UpscaleResult {
  url: string;
  /** Null when the server could not read the result's size. */
  width: number | null;
  height: number | null;
  /** 1 = crop only (the photo was already large enough). */
  scale: 1 | 2 | 3 | 4;
  sourceWidth: number | null;
  sourceHeight: number | null;
}

export type UpscaleJobStatus = "queued" | "processing" | "done" | "failed";

/** Mirrors the server ImageUpscaleJobDto (also the `upscale.job.updated` event payload). */
export interface UpscaleJob {
  id: string;
  quoteId: string | null;
  sourceKind: "quote_image" | "upload";
  originalUrl: string;
  resultUrl: string | null;
  status: UpscaleJobStatus;
  error: string | null;
  scale: number | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  resultWidth: number | null;
  resultHeight: number | null;
  replacedOnQuote: boolean;
  revertedAt: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export type CreateUpscaleJobParams =
  | { quoteId: string; imageUrl: string }
  | { quoteId?: string; file: File };

export const isJobActive = (job: Pick<UpscaleJob, "status">): boolean =>
  job.status === "queued" || job.status === "processing";

/** Mirrors the server allowlist and multer limit for POST /api/v2/image-upscale/jobs. */
export const UPSCALE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const UPSCALE_MAX_BYTES = 20 * 1024 * 1024;

/** Side of the square post image (Instagram feed) every image is formatted to; mirrors the server. */
export const POST_IMAGE_SIZE = 1080;
