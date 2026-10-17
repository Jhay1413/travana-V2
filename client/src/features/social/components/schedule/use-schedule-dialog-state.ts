import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { EnrichedQuote } from "@/features/quote/types";
import type { TravelDeal } from "@/features/social/api/social-post.api";
import { useFetchTravelDeal } from "@/features/social/api/use-social-post-queries";

export interface ScheduleTarget {
  quote: EnrichedQuote;
  deal: TravelDeal;
  mode: "schedule" | "change-time";
  initialDate?: string;
}

/** Loads a quote's post and opens the schedule dialog for it (grid and calendar wiring). */
export function useScheduleDialogState() {
  const { toast } = useToast();
  const fetchTravelDeal = useFetchTravelDeal();
  const [target, setTarget] = useState<ScheduleTarget | null>(null);
  const [open, setOpen] = useState(false);

  const openSchedule = useCallback(
    async (quote: EnrichedQuote, mode: "schedule" | "change-time", initialDate?: string): Promise<void> => {
      try {
        const deal = await fetchTravelDeal(quote.id);
        if (!deal) {
          toast({ title: "Generate a post first", variant: "destructive" });
          return;
        }
        setTarget({ quote, deal, mode, initialDate });
        setOpen(true);
      } catch {
        toast({ title: "Could not load the post", variant: "destructive" });
      }
    },
    [toast, fetchTravelDeal],
  );

  const onScheduleDraft = useCallback(
    (quote: EnrichedQuote, dateYmd: string) => {
      void openSchedule(quote, "schedule", dateYmd);
    },
    [openSchedule],
  );

  const onChangeTime = useCallback(
    (quote: EnrichedQuote) => {
      void openSchedule(quote, quote.onlySocialsId ? "change-time" : "schedule");
    },
    [openSchedule],
  );

  return { target, open, onOpenChange: setOpen, openSchedule, onScheduleDraft, onChangeTime };
}
