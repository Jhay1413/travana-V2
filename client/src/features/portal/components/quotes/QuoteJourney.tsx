import type { JourneyItem } from "../../lib/quote-journey";
import { toRoman } from "../../lib/quote-format";

/** "Your journey": every item the quote has, in order, as a hairline numbered list. */
export function QuoteJourney({ items }: { items: JourneyItem[] }) {
  if (items.length === 0) return null;
  return (
    <ol className="border-b border-border" data-testid="quote-journey">
      {items.map((s, i) => (
        <li key={s.key} className="flex gap-5 border-t border-border py-[26px]" data-testid={`journey-item-${s.key}`} data-kind={s.kind}>
          <span className="portal-serif w-8 flex-none text-[22px] portal-text-amber-ink" aria-hidden>
            {toRoman(i + 1)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="portal-caps-label">{s.kicker}</span>
            <span className="portal-serif break-words text-[23px] font-medium leading-tight text-primary">{s.title}</span>
            {s.flight && (s.flight.dep || s.flight.arr) && (
              <div className="my-1 flex items-center gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="portal-serif text-[30px] leading-none portal-text-ink">{s.flight.dep || "–"}</span>
                  <span className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{s.flight.from}</span>
                </span>
                <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
                <span className="flex min-w-0 flex-col text-right">
                  <span className="portal-serif text-[30px] leading-none portal-text-ink" aria-label={`arrives ${s.flight.arr}${s.flight.nextDay ? " the next day" : ""}`}>
                    {s.flight.arr || "–"}
                    {s.flight.nextDay ? " +1" : ""}
                  </span>
                  <span className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{s.flight.to}</span>
                </span>
              </div>
            )}
            {s.detail.map((line, j) => (
              <p key={j} className="text-[15px] leading-[1.7] text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
