import { useState } from "react";
import { Plane, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import type { EnrichedBooking, EnrichedQuote } from "@/features/quote/types";
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";
import { MoneyBody } from "@/features/client/components/holiday/money-card";
import { TripBody } from "@/features/client/components/holiday/trip-card";

type Tab = "trip" | "costings";

const TABS = [
  { value: "trip", label: "The Trip", Icon: Plane },
  { value: "costings", label: "Costings", Icon: Tag },
] as const;

export interface TripCostingsCardProps {
  display: QuoteDisplay;
  raw: EnrichedQuote | EnrichedBooking;
  mode: "quote" | "booking";
  /** Opens the edit drawer; omitted when read-only. */
  onEdit?: () => void;
}

/** Right-column card with two tabs: the trip timeline and the team-only costings (price and profit). */
export function TripCostingsCard({ display, raw, mode, onEdit }: TripCostingsCardProps) {
  const [tab, setTab] = useState<Tab>("trip");
  return (
    <section className={HOLIDAY_CARD} aria-label="The trip and costings" data-testid="holiday-trip-costings-card">
      <div role="tablist" aria-label="Trip and costings" className="-mt-1 mb-4 flex border-b border-social-border">
        {TABS.map(({ value, label, Icon }) => {
          const selected = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(value)}
              className={cn(
                "-mb-px inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-t-[10px] border-b-[3px] px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "border-social-navy text-social-navy" : "border-transparent text-qp-muted hover:text-foreground",
              )}
              data-testid={`holiday-trip-costings-tab-${value}`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" aria-label={tab === "trip" ? "The Trip" : "Costings"}>
        {tab === "trip" ? <TripBody display={display} onEdit={onEdit} /> : <MoneyBody raw={raw} mode={mode} />}
      </div>
    </section>
  );
}
