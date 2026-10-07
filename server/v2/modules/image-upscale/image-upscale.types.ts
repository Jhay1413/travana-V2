export type UpscaleScale = 2 | 3 | 4;

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
  scale: UpscaleScale;
  sourceWidth: number | null;
  sourceHeight: number | null;
}
