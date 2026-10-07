import axios from "axios";
import { imageSize } from "image-size";
import { AppError } from "../../utils/error-handler";
import { presignImageKey, s3KeyFromStoredUrl, uploadBufferToS3 } from "../../utils/image-storage";
import { resolveUploadableUrl } from "../social-post/social-post.service";
import { assertPublicHttpUrl } from "../../utils/safe-fetch-url";
import { usageService } from "../usage/usage.service";
import type { PerformUpscaleInput, PerformUpscaleResult, UpscaleProvider, UpscaleScale } from "./image-upscale.types";

const TARGET_WIDTH = 3840;
const SOURCE_MAX_BYTES = 15 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 20_000;
const RESULT_MAX_BYTES = 30 * 1024 * 1024;
const RESULT_TIMEOUT_MS = 60_000;
export const SOURCE_PREFIX = "social-upscale/source";
const RESULT_PREFIX = "social-upscale";
// Standalone tool uploads (no quote) are kept apart from quote-bound ones.
export const STANDALONE_SOURCE_PREFIX = "image-upscale/source";
const STANDALONE_RESULT_PREFIX = "image-upscale";
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

function readDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    const { width, height } = imageSize(buffer);
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}

/** Smallest integer scale (2-4) that takes the image to at least 3840px wide. */
function chooseScale(width: number | null): UpscaleScale {
  if (!width) return 2;
  const scale = Math.min(4, Math.max(2, Math.ceil(TARGET_WIDTH / width)));
  return scale as UpscaleScale;
}

/** A url fal can fetch. Resolved when the job RUNS so a queued job never holds an expired presign. */
async function resolveFetchableUrl(input: PerformUpscaleInput): Promise<string> {
  if (input.sourceKind === "upload") {
    const key = s3KeyFromStoredUrl(input.originalUrl);
    if (!key) throw new AppError("Failed to read source image", 500);
    return presignImageKey(key);
  }
  // Quote membership was validated when the job was created.
  return resolveUploadableUrl(input.originalUrl);
}

export function createUpscalePipeline(provider: UpscaleProvider) {
  return {
    async performUpscale(input: PerformUpscaleInput): Promise<PerformUpscaleResult> {
      const fetchableUrl = await resolveFetchableUrl(input);

      // Only urls that resolved to our own S3 (presigned) skip the public-host guard.
      const ownStorage = input.sourceKind === "upload" || s3KeyFromStoredUrl(input.originalUrl) !== null;
      const sourceBytes = await download(fetchableUrl, SOURCE_MAX_BYTES, SOURCE_TIMEOUT_MS, "source image", !ownStorage);
      const dims = readDimensions(sourceBytes);
      if (dims && dims.width >= TARGET_WIDTH) {
        throw new AppError("Image is already 4K or larger", 400);
      }
      const scale = chooseScale(dims?.width ?? null);

      const upscaled = await provider.upscale({ imageUrl: fetchableUrl, scale });

      const resultBytes = await download(upscaled.url, RESULT_MAX_BYTES, RESULT_TIMEOUT_MS, "upscaled image");
      const contentType = upscaled.contentType.startsWith("image/") ? upscaled.contentType : "image/jpeg";
      const dimsOut = readDimensions(resultBytes);
      const url = await uploadBufferToS3(resultBytes, contentType, input.quoteId ? RESULT_PREFIX : STANDALONE_RESULT_PREFIX);

      void usageService.recordAiUsage({
        orgId: input.orgId,
        feature: "image_upscale",
        site: "image-upscale:esrgan",
        model: USAGE_MODEL,
        usage: { promptTokens: 0, completionTokens: 0 },
        userId: input.userId,
      });

      return {
        url,
        // null (not 0) when neither image-size nor the provider knows the size.
        width: dimsOut?.width ?? (upscaled.width || null),
        height: dimsOut?.height ?? (upscaled.height || null),
        scale,
        sourceWidth: dims?.width ?? null,
        sourceHeight: dims?.height ?? null,
      };
    },
  };
}
