import { fal } from "@fal-ai/client";
import { z } from "zod";
import { AppError } from "../../../utils/error-handler";
import type { UpscaleProvider, UpscaleProviderInput, UpscaleProviderResult } from "../image-upscale.types";

const FAL_MODEL = "fal-ai/esrgan";
/** A hung fal call must not hold a worker slot forever. */
export const FAL_TIMEOUT_MS = 4 * 60 * 1000;

class FalTimeoutError extends Error {}

const falOutputSchema = z.object({
  image: z.object({
    url: z.string().url(),
    width: z.number().optional(),
    height: z.number().optional(),
    content_type: z.string().optional(),
  }),
});

function ensureConfigured(): void {
  const key = process.env.FAL_KEY;
  if (!key) throw new AppError("Image upscaler is not configured (FAL_KEY)", 500);
  fal.config({ credentials: key });
}

export const falEsrganProvider: UpscaleProvider = {
  async upscale({ imageUrl, scale }: UpscaleProviderInput): Promise<UpscaleProviderResult> {
    ensureConfigured();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new FalTimeoutError("fal request timed out"));
      }, FAL_TIMEOUT_MS);
    });
    try {
      const result = await Promise.race([
        fal.subscribe(FAL_MODEL, {
          input: { image_url: imageUrl, scale, face: false, output_format: "jpeg" },
          logs: false,
          abortSignal: controller.signal,
        }),
        timeout,
      ]);
      const parsed = falOutputSchema.parse(result.data);
      return {
        url: parsed.image.url,
        width: parsed.image.width ?? 0,
        height: parsed.image.height ?? 0,
        contentType: parsed.image.content_type ?? "image/jpeg",
      };
    } catch (err) {
      console.error("[ImageUpscale] fal.ai request failed:", err);
      if (err instanceof FalTimeoutError) throw new AppError("Image upscaling timed out", 502);
      throw new AppError("Image upscaling failed. Please try again.", 502);
    } finally {
      clearTimeout(timer);
    }
  },
};
