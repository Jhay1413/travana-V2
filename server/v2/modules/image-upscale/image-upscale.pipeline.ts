import axios from "axios";
import { imageSize } from "image-size";
import { AppError } from "../../utils/error-handler";
import { fetchViaHeadlessBrowser } from "../../utils/browser-fetch";
import { presignImageKey, s3KeyFromStoredUrl, uploadBufferToS3 } from "../../utils/image-storage";
import { resolveUploadableUrl } from "../social-post/social-post.service";
import { assertPublicHttpUrl } from "../../utils/safe-fetch-url";
import { usageService } from "../usage/usage.service";
import { POST_IMAGE_SIZE } from "./image-upscale.types";
import { toSquare } from "./image-format.util";
import type {
  FetchedSource,
  ImageDims,
  PerformUpscaleInput,
  PerformUpscaleResult,
  FormatScale,
  UpscaleProvider,
  UpscaleScale,
} from "./image-upscale.types";

const SOURCE_MAX_BYTES = 15 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 20_000;
const RESULT_MAX_BYTES = 30 * 1024 * 1024;
const RESULT_TIMEOUT_MS = 60_000;
export const SOURCE_PREFIX = "social-upscale/source";
const RESULT_PREFIX = "social-upscale";
// Standalone tool uploads (no quote) are kept apart from quote-bound ones.
export const STANDALONE_SOURCE_PREFIX = "image-upscale/source";
const STANDALONE_RESULT_PREFIX = "image-upscale";

/** True when the S3 key is an upscaled output (not a source copy) of either pipeline. */
export function isUpscaleResultKey(key: string): boolean {
  return (
    (key.startsWith(`${RESULT_PREFIX}/`) && !key.startsWith(`${SOURCE_PREFIX}/`)) ||
    (key.startsWith(`${STANDALONE_RESULT_PREFIX}/`) && !key.startsWith(`${STANDALONE_SOURCE_PREFIX}/`))
  );
}
const USAGE_MODEL = "fal-ai/esrgan";

/**
 * `untrusted` urls (a quote image hosted somewhere else) must resolve to a
 * public address and may not redirect, so a quote row cannot be used to make
 * the server fetch internal hosts. Our own presigned S3 urls and fal's output
 * urls are trusted.
 */
async function download(
  url: string,
  maxBytes: number,
  timeout: number,
  what: string,
  untrusted = false,
): Promise<Buffer> {
  if (untrusted) await assertPublicHttpUrl(url);
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      ...(untrusted ? { maxRedirects: 0 } : {}),
    });
    return Buffer.from(res.data);
  } catch (err) {
    if (untrusted && axios.isAxiosError(err) && err.response && err.response.status >= 300 && err.response.status < 400) {
      throw new AppError("Image URL redirects are not allowed", 400);
    }
    console.error(`[ImageUpscale] failed to download ${what}:`, err instanceof Error ? err.message : err);
    throw new AppError(`Could not download the ${what}`, 502);
  }
}

interface ExternalSource {
  buffer: Buffer;
  contentType: string | null;
}

/**
 * Downloads a supplier-hosted image. Bot-protected CDNs (e.g. TUI/Akamai) 403
 * plain HTTP clients, so any non-redirect failure is retried through a real
 * headless browser. Redirects stay refused (a clear 400) on the direct path.
 */
async function downloadExternalSource(url: string): Promise<ExternalSource> {
  await assertPublicHttpUrl(url);
  let upstream: string;
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: SOURCE_TIMEOUT_MS,
      maxContentLength: SOURCE_MAX_BYTES,
      maxBodyLength: SOURCE_MAX_BYTES,
      maxRedirects: 0,
    });
    const header: unknown = res.headers?.["content-type"];
    return { buffer: Buffer.from(res.data), contentType: typeof header === "string" ? header : null };
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status !== undefined && status >= 300 && status < 400) {
      throw new AppError("Image URL redirects are not allowed", 400);
    }
    upstream = status !== undefined ? String(status) : err instanceof Error ? err.message : "network error";
  }

  console.warn(`[ImageUpscale] direct download failed (status ${upstream}) — retrying via headless browser`);
  try {
    const res = await fetchViaHeadlessBrowser(url, { timeoutMs: SOURCE_TIMEOUT_MS * 1.5, maxBytes: SOURCE_MAX_BYTES });
    return { buffer: res.buffer, contentType: res.contentType };
  } catch (err) {
    console.error(
      `[ImageUpscale] failed to download source image (direct status ${upstream}); headless browser:`,
      err instanceof Error ? err.message : err,
    );
    throw new AppError("Could not download the source image", 502);
  }
}

/** image/* response type, else the type image-size sniffed, else jpeg. */
function sourceContentType(headerType: string | null, sniffed?: string): string {
  const header = headerType?.split(";")[0].trim().toLowerCase();
  if (header?.startsWith("image/")) return header;
  if (sniffed) return `image/${sniffed === "jpg" ? "jpeg" : sniffed}`;
  return "image/jpeg";
}

export function readDimensions(buffer: Buffer): ImageDims | null {
  try {
    const { width, height, type } = imageSize(buffer);
    return width && height ? { width, height, type } : null;
  } catch {
    return null;
  }
}

/** Smallest integer scale (2-4) that takes the short side to at least the post size; very small images get 4x as best effort. */
function chooseScale(shortSide: number | null): UpscaleScale {
  if (!shortSide) return 2;
  const scale = Math.min(4, Math.max(2, Math.ceil(POST_IMAGE_SIZE / shortSide)));
  return scale as UpscaleScale;
}

/** A url fal can fetch. Resolved when the job RUNS so a queued job never holds an expired presign. */
async function resolveFetchableUrl(input: Pick<PerformUpscaleInput, "originalUrl" | "sourceKind">): Promise<string> {
  if (input.sourceKind === "upload") {
    const key = s3KeyFromStoredUrl(input.originalUrl);
    if (!key) throw new AppError("Failed to read source image", 500);
    return presignImageKey(key);
  }
  // Quote membership was validated when the job was created.
  return resolveUploadableUrl(input.originalUrl);
}

/**
 * Download + measure step, usable on its own so callers can inspect the width
 * before committing to an upscale and hand the same bytes to `performUpscale`.
 * Writes nothing to S3.
 */
export async function fetchSourceForUpscale(
  input: Pick<PerformUpscaleInput, "originalUrl" | "sourceKind">,
): Promise<FetchedSource> {
  const fetchableUrl = await resolveFetchableUrl(input);

  // Only urls that resolved to our own S3 (presigned) skip the public-host guard.
  const ownStorage = input.sourceKind === "upload" || s3KeyFromStoredUrl(input.originalUrl) !== null;
  let buffer: Buffer;
  let contentType: string | null = null;
  if (ownStorage) {
    buffer = await download(fetchableUrl, SOURCE_MAX_BYTES, SOURCE_TIMEOUT_MS, "source image");
  } else {
    ({ buffer, contentType } = await downloadExternalSource(fetchableUrl));
  }
  return { buffer, contentType, dims: readDimensions(buffer), ownStorage, fetchableUrl };
}

export function createUpscalePipeline(provider: UpscaleProvider) {
  return {
    /**
     * Produces the `POST_IMAGE_SIZE` square post image: upscales with the provider only
     * when the short side is under the target (scale 1 = crop only, no provider call),
     * then centre-crops. `prefetched` (from `fetchSourceForUpscale`) skips the download.
     */
    async performUpscale(input: PerformUpscaleInput, prefetched?: FetchedSource): Promise<PerformUpscaleResult> {
      const source = prefetched ?? (await fetchSourceForUpscale(input));
      const { buffer: sourceBytes, contentType: sourceType, dims, ownStorage, fetchableUrl } = source;
      if (dims && dims.width === POST_IMAGE_SIZE && dims.height === POST_IMAGE_SIZE) {
        throw new AppError(`Image is already ${POST_IMAGE_SIZE}×${POST_IMAGE_SIZE}`, 400);
      }
      const shortSide = dims ? Math.min(dims.width, dims.height) : null;
      const needsUpscale = shortSide === null || shortSide < POST_IMAGE_SIZE;
      const scale: FormatScale = needsUpscale ? chooseScale(shortSide) : 1;
      const srcType = sourceContentType(sourceType, dims?.type);

      let bytesToCrop = sourceBytes;
      if (needsUpscale) {
        // fal fetches the url itself and would hit the same CDN block, so external
        // sources are handed over as our own S3 copy.
        let providerUrl = fetchableUrl;
        if (!ownStorage) {
          const copyUrl = await uploadBufferToS3(
            sourceBytes,
            srcType,
            input.quoteId ? SOURCE_PREFIX : STANDALONE_SOURCE_PREFIX,
          );
          const copyKey = s3KeyFromStoredUrl(copyUrl);
          if (!copyKey) throw new AppError("Failed to store source image", 500);
          providerUrl = await presignImageKey(copyKey);
        }

        const upscaled = await provider.upscale({ imageUrl: providerUrl, scale: scale as UpscaleScale });
        bytesToCrop = await download(upscaled.url, RESULT_MAX_BYTES, RESULT_TIMEOUT_MS, "upscaled image");

        void usageService.recordAiUsage({
          orgId: input.orgId,
          feature: "image_upscale",
          site: "image-upscale:esrgan",
          model: USAGE_MODEL,
          usage: { promptTokens: 0, completionTokens: 0 },
          userId: input.userId,
        });
      }

      let square: Awaited<ReturnType<typeof toSquare>>;
      try {
        square = await toSquare(bytesToCrop, POST_IMAGE_SIZE, srcType === "image/png");
      } catch (err) {
        console.error("[ImageUpscale] could not format image:", err instanceof Error ? err.message : err);
        throw new AppError("Could not format the image", 422);
      }
      const url = await uploadBufferToS3(square.buffer, square.contentType, input.quoteId ? RESULT_PREFIX : STANDALONE_RESULT_PREFIX);

      return {
        url,
        width: square.width,
        height: square.height,
        scale,
        sourceWidth: dims?.width ?? null,
        sourceHeight: dims?.height ?? null,
      };
    },
  };
}
