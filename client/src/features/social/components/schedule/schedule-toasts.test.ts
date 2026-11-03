import { describe, expect, it } from "vitest";
import type { SchedulePostResult } from "@/features/social/api/social-post.api";
import { buildScheduleToast } from "./schedule-toasts";

function result(overrides: Record<string, unknown>): SchedulePostResult {
  return overrides as unknown as SchedulePostResult;
}

describe("buildScheduleToast", () => {
  it("uses plain wording for a clean schedule and reschedule", () => {
    expect(buildScheduleToast(result({}), false)).toEqual({
      title: "Post saved and scheduled on OnlySocials",
      description: undefined,
    });
    expect(buildScheduleToast(result({}), true).title).toBe("Post updated and rescheduled on OnlySocials");
  });

  it("warns when images failed to upload", () => {
    const toast = buildScheduleToast(result({ failedImageUrls: ["a", "b"] }), false);
    expect(toast.variant).toBe("destructive");
    expect(toast.title).toBe("Post scheduled, but 2 images failed to upload");
  });

  it("reports formatted and upscaled counts", () => {
    const toast = buildScheduleToast(
      result({
        autoUpscale: {
          upscaled: [{ upscaled: true }, { upscaled: false }],
          skipped: [{ reason: "timeout" }],
        },
      }),
      true,
    );
    expect(toast.title).toBe("Rescheduled · 2 images formatted (1 upscaled)");
    expect(toast.description).toContain("1 image was posted at original size");
  });
});
