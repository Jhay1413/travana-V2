export type UpscaleScale = 2 | 3 | 4;
/** Stored job scale: 1 means crop-only (no provider call). */
export type FormatScale = 1 | UpscaleScale;

export interface UpscaleProviderInput {
  imageUrl: string;
  scale: UpscaleScale;
}

export interface UpscaleProviderResult {
  url: string;
  width: number;
  height: number;
  contentType: string;
}

/** Thin seam so the upscaling vendor can be swapped without touching the service. */
export interface UpscaleProvider {
  upscale(input: UpscaleProviderInput): Promise<UpscaleProviderResult>;
}

export type ImageUpscaleJobStatus = "queued" | "processing" | "done" | "failed";
export type ImageUpscaleSourceKind = "quote_image" | "upload";

/** What the API and the realtime event expose for a job (dates as ISO strings). */
export interface ImageUpscaleJobDto {
  id: string;
  quoteId: string | null;
  sourceKind: ImageUpscaleSourceKind;
  originalUrl: string;
  resultUrl: string | null;
  status: ImageUpscaleJobStatus;
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

export interface CreateUpscaleJobInput {
  /** Required with imageUrl; optional for a standalone file upload. */
  quoteId?: string;
  imageUrl?: string;
  file?: Express.Multer.File;
}

/** Everything the pipeline needs to upscale one image, independent of HTTP/scope. */
export interface PerformUpscaleInput {
  /** Quote image url, or the stored source-upload url. */
  originalUrl: string;
  sourceKind: ImageUpscaleSourceKind;
  quoteId: string | null;
  orgId: string;
  userId: string | null;
}

export interface PerformUpscaleResult {
  url: string;
  width: number | null;
  height: number | null;
  scale: FormatScale;
  sourceWidth: number | null;
  sourceHeight: number | null;
}

export interface ImageDims {
  width: number;
  height: number;
  type?: string;
}

/** A downloaded source image, measured and ready to be handed to the pipeline. */
export interface FetchedSource {
  buffer: Buffer;
  contentType: string | null;
  dims: ImageDims | null;
  /** True when the image already lives in our S3 (no copy needed for the provider). */
  ownStorage: boolean;
  /** A url fal can fetch: presigned when `ownStorage`, the original url otherwise. */
  fetchableUrl: string;
}

/** Side of the square post image (Instagram feed format) every image is formatted to. */
export const POST_IMAGE_SIZE = 1080;

export type AutoUpscaleSkipReason = "already_formatted" | "reused_previous" | "failed" | "cap_reached" | "timeout";

export interface AutoUpscaleSize {
  w: number;
  h: number;
}

export interface AutoUpscaleItem {
  /** The quote image url, or the uploaded file's name. */
  originalUrl: string;
  resultUrl: string;
  from: AutoUpscaleSize | null;
  to: AutoUpscaleSize | null;
  /** False when the image was only cropped (large enough already, no provider call). */
  upscaled: boolean;
}

export interface AutoUpscaleSkip {
  originalUrl: string;
  reason: AutoUpscaleSkipReason;
  message?: string;
}

export interface PrepareImagesInput {
  quoteId: string;
  imageUrls: string[];
  files: Express.Multer.File[];
  /** `orgId` is null for trusted/internal callers and platform admins: nothing is formatted then. */
  scope: { orgId: string | null; userId?: string | null };
}

export interface PrepareImagesResult {
  imageUrls: string[];
  files: Express.Multer.File[];
  upscaled: AutoUpscaleItem[];
  skipped: AutoUpscaleSkip[];
}
