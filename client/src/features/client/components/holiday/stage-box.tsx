import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuoteCustomerActions, useQuoteViews } from "@/features/quote/api/use-quote-share-queries";
import { useMarkQuoteAccepted } from "@/features/quote/api/use-quote-mutations";
import { deriveQuoteStage, sentSummary, type QuoteStep } from "@/features/quote/lib/quote-stage";
import { HOLIDAY_BTN_GHOST, HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

export interface StageBoxProps {
  mode: "quote" | "booking";
  /** Quote whose views and customer actions drive the steps. Empty when a booking has no source quote. */
  quoteId: string;
  createdAt: string | null;
  sentAt?: string | null;
  sentVia?: string | null;
  /** Manual "accepted" mark on the quote. */
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  isBooked: boolean;
  bookedAt: string | null;
  readOnly: boolean;
  clientFirstName: string;
}

function dotClass(state: QuoteStep["state"]): string {
  if (state === "done") return "border-qp-step-done-bg bg-qp-step-done-bg text-qp-step-done-fg";
  if (state === "now") return "border-qp-now-ring bg-qp-chip-bg text-qp-orange-text shadow-[0_0_0_4px] shadow-qp-now-ring/20";
  return "border-social-border bg-card text-qp-muted";
}

/** Note under a step: blank for a booking with no source quote, neutral when views cannot be read. */
function stepNote(step: QuoteStep, mode: "quote" | "booking", quoteId: string, unavailable: boolean): string {
  if (mode === "booking" && !quoteId && step.id !== "created" && step.id !== "booked") return "";
  if (unavailable && (step.id === "viewed" || step.id === "accepted")) return "Views unavailable";
  return step.note;
}

/**
 * "Where this quote is" / "How this booking happened": the five-step stepper.
 * Mark accepted (and Undo for a manual mark) are hidden for read-only roles.
 */
export function StageBox(props: StageBoxProps) {
  const { mode, quoteId, readOnly, isBooked } = props;
  const { toast } = useToast();
  const { data: views, isError: viewsError } = useQuoteViews(quoteId);
  const { data: actions, isError: actionsError } = useQuoteCustomerActions(quoteId);
  const unavailable = viewsError || actionsError;
  const markAccepted = useMarkQuoteAccepted();

  const accepted = actions?.find((a) => a.actionType === "accepted");
  const stage = deriveQuoteStage({
    createdAt: props.createdAt,
    sentAt: props.sentAt ?? null,
    viewCount: views?.totalViews ?? 0,
    lastViewedAt: views?.lastViewed ?? null,
    customerAccepted: accepted ? { at: accepted.createdAt, name: accepted.customerName } : null,
    manualAccepted: props.acceptedAt ? { at: props.acceptedAt, byName: props.acceptedByName ?? null } : null,
    isBooked,
    bookedAt: props.bookedAt,
    clientFirstName: props.clientFirstName,
  });
  const sent = sentSummary(props.sentAt, props.sentVia);

  const setAccepted = (value: boolean) =>
    markAccepted.mutate(
      { quoteId, accepted: value },
      {
        onSuccess: () => toast({ title: value ? "Marked as accepted. Take the deposit to book." : "Acceptance removed" }),
        onError: () => toast({ title: "Could not update the quote", variant: "destructive" }),
      },
    );

  const canAct = !readOnly && mode === "quote" && !!quoteId;

  return (
    <section className={HOLIDAY_CARD} aria-labelledby="holiday-stage-h" data-testid="holiday-stage-box">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
        <h2 id="holiday-stage-h" className="text-base font-semibold leading-snug">
          {mode === "booking" ? "How this booking happened" : "Where this quote is"}
        </h2>
        {sent && <span className="text-[13px] text-qp-muted">{sent}</span>}
      </div>
      <ol
        className="grid grid-cols-5 pt-2.5 max-[620px]:grid-cols-[repeat(5,minmax(76px,1fr))] max-[620px]:overflow-x-auto"
        aria-label={mode === "booking" ? "How this booking happened" : "Where this quote is"}
      >
        {stage.steps.map((step, i) => (
          <li
            key={step.id}
            aria-current={step.state === "now" ? "step" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-1 text-center text-xs text-qp-muted",
              i > 0 &&
                "before:absolute before:left-[calc(-50%+16px)] before:right-[calc(50%+16px)] before:top-[13px] before:h-[3px] before:rounded-full before:content-['']",
              i > 0 && (step.state === "todo" ? "before:bg-social-border" : "before:bg-qp-step-done-bg"),
            )}
          >
            <span className={cn("z-[1] grid size-7 place-items-center rounded-full border-2 font-semibold", dotClass(step.state))}>
              {step.state === "done" ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : i + 1}
            </span>
            <b className="text-[13px] font-semibold text-foreground">{step.label}</b>
            <span>{stepNote(step, mode, quoteId, unavailable)}</span>
            {step.id === "accepted" && canAct && stage.canMarkAccepted && (
              <button
                type="button"
                className={cn(HOLIDAY_BTN_GHOST, "min-h-7 text-xs")}
                disabled={markAccepted.isPending}
                onClick={() => setAccepted(true)}
                data-testid="button-mark-accepted"
              >
                Mark accepted
              </button>
            )}
            {step.id === "accepted" && canAct && stage.canUndo && (
              <button
                type="button"
                className="text-xs font-semibold text-status-posted-fg hover:underline disabled:opacity-50"
                disabled={markAccepted.isPending}
                onClick={() => setAccepted(false)}
                data-testid="button-undo-accepted"
              >
                Undo
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
