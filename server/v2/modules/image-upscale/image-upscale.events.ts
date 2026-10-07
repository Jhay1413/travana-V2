import { realtimeService } from "../../realtime/realtime.service";
import { toImageUpscaleJobDto } from "./image-upscale.mapper";
import type { ImageUpscaleJob } from "@shared/schema";

/**
 * Pushes a job change to the org's SSE streams. Never throws: a delivery
 * problem must not change the outcome of the job (clients also poll).
 *
 * Jobs without a quote (private standalone uploads) are not pushed — the
 * stream is org-wide and those results belong to their creator, whose page
 * polls `GET /jobs/:id` instead.
 */
export function publishJobUpdated(job: ImageUpscaleJob): void {
  if (!job.quoteId) return;
  try {
    realtimeService.publish(job.orgId, { type: "upscale.job.updated", orgId: job.orgId, job: toImageUpscaleJobDto(job) });
  } catch (err) {
    console.error("[ImageUpscale] failed to publish job update:", err);
  }
}
