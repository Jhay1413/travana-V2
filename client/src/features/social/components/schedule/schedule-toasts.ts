import type { SchedulePostResult } from "@/features/social/api/social-post.api";

export interface ScheduleToast {
  title: string;
  description?: string;
  variant?: "destructive";
}

const imagesLabel = (n: number) => `${n} image${n === 1 ? "" : "s"}`;

/** Toast shown after a (re)schedule request; mirrors the editor dialog's wording. */
export function buildScheduleToast(result: SchedulePostResult, isReschedule: boolean): ScheduleToast {
  const failedImages = result.failedImageUrls ?? [];
  const formattedCount = result.autoUpscale?.upscaled.length ?? 0;
  const upscaledCount = result.autoUpscale?.upscaled.filter((i) => i.upscaled).length ?? 0;
  const atOriginalSize =
    result.autoUpscale?.skipped.filter((s) => s.reason === "failed" || s.reason === "timeout").length ?? 0;
  const originalSizeNote =
    atOriginalSize > 0
      ? `${atOriginalSize} image${atOriginalSize === 1 ? " was" : "s were"} posted at original size`
      : null;

  if (failedImages.length > 0) {
    return {
      title: `Post ${isReschedule ? "rescheduled" : "scheduled"}, but ${failedImages.length} image${failedImages.length > 1 ? "s" : ""} failed to upload`,
      description: ["Reopen the post and reschedule to retry the missing images.", originalSizeNote]
        .filter(Boolean)
        .join("\n"),
      variant: "destructive",
    };
  }

  const done = isReschedule ? "Post updated and rescheduled on OnlySocials" : "Post saved and scheduled on OnlySocials";
  return {
    title:
      formattedCount > 0
        ? `${isReschedule ? "Rescheduled" : "Scheduled"} · ${imagesLabel(formattedCount)} formatted (${upscaledCount} upscaled)`
        : done,
    description: [formattedCount > 0 ? done : null, originalSizeNote].filter(Boolean).join("\n") || undefined,
  };
}
