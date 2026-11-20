import { scheduleToLocal } from "@/features/social/lib/schedule-time";
import type { UpdatePostInput } from "@/features/social/api/social-post.api";

interface SaveTextInput {
  post: string;
  /** Stored UTC publish time of the deal (null for a draft). */
  postSchedule: string | null | undefined;
  /** Still waiting to go out on OnlySocials: the server pushes the text there, so it needs the time to keep. */
  isPending: boolean;
  isScheduled: boolean;
  /** Account ticks to remember on a draft; empty/undefined when there is nothing to send. */
  accountIds?: number[];
}

/**
 * Body of the "Save draft / Save changes" PATCH. A pending post also carries the wall-clock of its stored
 * schedule (in the browser's zone, like every other time sent to OnlySocials) so the server re-sends the same time.
 */
export function buildSaveTextPayload({ post, postSchedule, isPending, isScheduled, accountIds }: SaveTextInput): UpdatePostInput {
  const data: UpdatePostInput = { post };
  if (!isScheduled && accountIds && accountIds.length > 0) data.accountIds = accountIds;
  if (isPending) {
    const local = scheduleToLocal(postSchedule);
    if (local) data.postScheduleLocal = local;
  }
  return data;
}

/**
 * "Save & reschedule" saves the text first (a separate PATCH) except for a pending post: its reschedule request
 * already carries the text and the server saves it, so a pre-save would push the same text to OnlySocials twice.
 */
export function shouldPreSaveText(isPending: boolean): boolean {
  return !isPending;
}
