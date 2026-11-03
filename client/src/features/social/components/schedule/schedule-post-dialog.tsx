import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import type { EnrichedQuote } from "@/features/quote/types";
import type { TravelDeal } from "@/features/social/api/social-post.api";
import { useRescheduleOnOnlySocials, useScheduleOnOnlySocials } from "@/features/social/api/use-social-post-mutations";
import { useFetchPostMedia, useFetchQuoteImages, useFetchTravelDeal } from "@/features/social/api/use-social-post-queries";
import { useSocialSettings } from "@/features/social/api/use-social-settings-queries";
import { DEFAULT_SOCIAL_SETTINGS } from "@/features/social/api/social-settings.api";
import { getFirstImage, pricePerPersonLabel } from "@/features/social/lib/quote-card-fields";
import { errorMessage } from "@/features/social/lib/error-message";
import { browserTimezoneLabel, goesOutLabel } from "@/features/social/lib/schedule-time";
import { TimeShortcutChips } from "./time-shortcut-chips";
import { validateSchedule } from "./schedule-form";
import { buildScheduleToast } from "./schedule-toasts";
import { buildScheduleForm, toFormData } from "./build-schedule-form";

export interface SchedulePostDialogProps {
  quote: EnrichedQuote;
  deal: TravelDeal;
  /** "YYYY-MM-DD" to pre-fill the date picker. */
  initialDate?: string;
  mode: "schedule" | "change-time";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Initial date/time: the quote's current schedule for "change-time", else blanks. */
function initialParts(quote: EnrichedQuote, mode: "schedule" | "change-time", initialDate?: string) {
  if (mode === "change-time" && quote.postSchedule) {
    const d = new Date(quote.postSchedule);
    if (!Number.isNaN(d.getTime())) return { date: format(d, "yyyy-MM-dd"), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
  return { date: initialDate ?? "", time: "" };
}

/** Small dialog to pick when a post goes out, without opening the full editor. */
export function SchedulePostDialog({ quote, deal, initialDate, mode, open, onOpenChange }: SchedulePostDialogProps) {
  const { toast } = useToast();
  const { data: settings } = useSocialSettings();
  const { timeShortcuts, timezone } = settings ?? DEFAULT_SOCIAL_SETTINGS;
  const schedule = useScheduleOnOnlySocials();
  const reschedule = useRescheduleOnOnlySocials();
  const fetchTravelDeal = useFetchTravelDeal();
  const fetchPostMedia = useFetchPostMedia();
  const fetchQuoteImages = useFetchQuoteImages();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const parts = initialParts(quote, mode, initialDate);
    setDate(parts.date);
    setTime(parts.time);
    setError(null);
  }, [open, quote, mode, initialDate]);

  const isChange = mode === "change-time";
  const today = format(new Date(), "yyyy-MM-dd");
  const goesOut = date && time ? goesOutLabel(`${date}T${time}`) : "";
  const image = getFirstImage(quote) ?? "/images/default-hotel.jpg";
  const operator = quote.main_tour_operator_name;

  const submit = async () => {
    const result = validateSchedule(date, time);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isChange) {
        const [latest, media] = await Promise.all([fetchTravelDeal(quote.id), fetchPostMedia(deal.id)]);
        const formData = toFormData(
          buildScheduleForm({
            kind: "reschedule",
            utcIso: result.utcIso,
            local: result.local,
            postContent: (latest ?? deal).post,
            existingImageIds: media.media.map((m) => m.id),
          }),
        );
        const saved = await reschedule.mutateAsync({ id: deal.id, formData });
        toast(buildScheduleToast(saved, true));
      } else {
        // A never-scheduled post auto-selects every quote image in the editor; mirror that.
        const images = await fetchQuoteImages(quote.id);
        const formData = toFormData(
          buildScheduleForm({ kind: "schedule", utcIso: result.utcIso, local: result.local, imageUrls: images.map((i) => i.url) }),
        );
        const saved = await schedule.mutateAsync({ id: deal.id, formData });
        toast(buildScheduleToast(saved, false));
      }
      onOpenChange(false);
    } catch (err) {
      toast({ title: "OnlySocials error", description: errorMessage(err, "Failed to push to OnlySocials"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-[560px] gap-5" data-testid="dialog-schedule-post">
        <DialogHeader>
          <DialogTitle>{isChange ? "Change time" : "Schedule post"}</DialogTitle>
          <DialogDescription>Pick the day and time it goes out. Drafts never post.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-social-border bg-social-page p-3">
          <img src={image} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{quote.title || "Untitled"}</p>
            <p className="truncate text-xs text-social-muted">
              {[pricePerPersonLabel(quote), operator].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
              className="h-10 w-44 rounded-lg"
              data-testid="input-schedule-dialog-date"
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={busy}
              className="h-10 w-32 rounded-lg"
              data-testid="input-schedule-dialog-time"
            />
            <span className="text-xs text-social-muted">{browserTimezoneLabel(timezone)}</span>
          </div>
          <TimeShortcutChips times={timeShortcuts} value={time} onPick={setTime} disabled={busy} />
          {goesOut && <p className="text-xs font-medium text-social-muted">{goesOut}.</p>}
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={busy || !date || !time}
            className="gap-2 bg-social-orange text-slate-900 hover:bg-amber-600"
            data-testid="button-schedule-dialog-submit"
          >
            {busy && <Spinner className="h-4 w-4" />}
            {isChange ? "Save time" : "Schedule post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
