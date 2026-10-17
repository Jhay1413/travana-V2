import { useCallback } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type { EnrichedQuote } from "@/features/quote/types";
import { useFetchPostMedia, useFetchTravelDeal } from "../../api/use-social-post-queries";
import { errorMessage } from "../../lib/error-message";
import { buildScheduleForm, toFormData } from "../schedule/build-schedule-form";
import { useRescheduleOnOnlySocials } from "../../api/use-social-post-mutations";
import { moveKeepingTime } from "../../lib/calendar-grid";
import { isFutureLocal, time12 } from "../../lib/schedule-time";

interface UseCalendarDropArgs {
  scheduled: ReadonlyMap<string, EnrichedQuote>;
  drafts: ReadonlyMap<string, EnrichedQuote>;
  onScheduleDraft: (quote: EnrichedQuote, dateYmd: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Days before today cannot take a post. */
export function isDroppableDay(ymd: string, now: Date = new Date()): boolean {
  return ymd >= todayYmd(now);
}

export function todayYmd(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Drop handling for the calendar: reschedules scheduled posts, hands drafts to the owner. */
export function useCalendarDrop({ scheduled, drafts, onScheduleDraft }: UseCalendarDropArgs) {
  const reschedule = useRescheduleOnOnlySocials();
  const fetchTravelDeal = useFetchTravelDeal();
  const fetchPostMedia = useFetchPostMedia();

  const isDroppable = useCallback((ymd: string) => isDroppableDay(ymd), []);

  const drop = useCallback(
    async (targetYmd: string, quoteId: string) => {
      if (!isDroppable(targetYmd)) {
        toast({ title: "Pick today or a later day", variant: "destructive" });
        return;
      }
      const draft = drafts.get(quoteId);
      if (draft) {
        onScheduleDraft(draft, targetYmd);
        return;
      }
      const quote = scheduled.get(quoteId);
      if (!quote?.postSchedule) return;

      const local = moveKeepingTime(quote.postSchedule, targetYmd);
      if (!isFutureLocal(local)) {
        toast({ title: "That time is in the past", description: "Choose a later day.", variant: "destructive" });
        return;
      }
      try {
        const deal = await fetchTravelDeal(quote.id);
        if (!deal) throw new Error("Post not found");
        const { media } = await fetchPostMedia(deal.id);
        const formData = toFormData(
          buildScheduleForm({
            kind: "reschedule",
            utcIso: new Date(local).toISOString(),
            local,
            postContent: deal.post ?? "",
            existingImageIds: media.map((m) => m.id),
          }),
        );
        await reschedule.mutateAsync({ id: deal.id, formData });
        const at = new Date(local);
        toast({
          title: `Moved to ${format(at, "EEE d MMM")} · ${time12(format(at, "HH:mm"))}`,
        });
      } catch (err) {
        toast({
          title: "Could not move post",
          description: errorMessage(err, "Try again."),
          variant: "destructive",
        });
      }
    },
    [drafts, scheduled, onScheduleDraft, reschedule, isDroppable, fetchTravelDeal, fetchPostMedia],
  );

  return { drop, isDroppable, isMoving: reschedule.isPending };
}
