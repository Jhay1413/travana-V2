import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEAL_TILE_CLASSES, dealMetaLine, type DealRow as LiveDealRow, type ExpiredDealRow } from "./deals";
import { Section, SECTION_ACTION_CLASS } from "./section";

const EXPIRED_PREVIEW_LIMIT = 5;
// The pane shows the two most recent live deals; the "All" link opens the client page.
const LIVE_PREVIEW_LIMIT = 2;

const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

interface DealRowData {
  letter: string;
  tile: string;
  title: string;
  price: number;
  meta: string;
  isCopy: boolean;
  href: string;
  testId: string;
}

function DealRow({ row }: { row: DealRowData }) {
  const [, navigate] = useLocation();
  const open = () => navigate(row.href);
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="mb-2.5 flex cursor-pointer gap-2.5"
      data-testid={row.testId}
    >
      <span
        className={cn("grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] text-[14px] font-semibold", row.tile)}
        aria-hidden
      >
        {row.letter}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold">{row.title}</span>
            {row.isCopy && (
              <span className="shrink-0 rounded-full border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                Copy
              </span>
            )}
          </span>
          {row.price > 0 && <span className="shrink-0 text-[13px] font-semibold">{currency.format(row.price)}</span>}
        </div>
        {row.meta && <div className="truncate text-[12px] text-social-muted">{row.meta}</div>}
      </div>
    </div>
  );
}

interface DealsSectionProps {
  clientId: string;
  firstName: string;
  liveDeals: LiveDealRow[];
  expiredDeals: ExpiredDealRow[];
  isLoading: boolean;
}

export function DealsSection({ clientId, firstName, liveDeals, expiredDeals, isLoading }: DealsSectionProps) {
  const [expiredOpen, setExpiredOpen] = useState(false);
  const [showAllExpired, setShowAllExpired] = useState(false);
  const visibleExpired = showAllExpired ? expiredDeals : expiredDeals.slice(0, EXPIRED_PREVIEW_LIMIT);
  const base = `/clients/${clientId}`;
  return (
    <Section
      title="Deals"
      data-testid="client-live-quotes"
      action={
        <Link href={base} className={SECTION_ACTION_CLASS}>
          All
        </Link>
      }
    >
      {isLoading ? (
        <p className="text-[13px] text-social-muted">Loading…</p>
      ) : liveDeals.length === 0 ? (
        <p className="text-[13px] text-social-muted">No live deals for {firstName}</p>
      ) : (
        <div>
          {liveDeals.slice(0, LIVE_PREVIEW_LIMIT).map((d) => (
            <DealRow
              key={`${d.kind}-${d.id}`}
              row={{
                letter: d.letter,
                tile: DEAL_TILE_CLASSES[d.kind],
                title: d.title,
                price: d.price,
                meta: d.meta ? `${d.status} · ${d.meta}` : d.status,
                isCopy: d.isCopy,
                href: `${base}?holiday=${d.kind}:${d.id}`,
                testId: d.kind === "quote" ? `client-live-quote-${d.id}` : `client-live-${d.kind}-${d.id}`,
              }}
            />
          ))}
        </div>
      )}
      {expiredDeals.length > 0 && (
        <div className="mt-1" data-testid="client-expired-deals">
          <button
            type="button"
            onClick={() => setExpiredOpen((v) => !v)}
            className="flex w-full items-center gap-1 text-left text-[12px] font-medium text-social-muted hover:text-foreground"
            data-testid="client-expired-deals-toggle"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition", expiredOpen && "rotate-90")} />
            Expired ({expiredDeals.length})
          </button>
          {expiredOpen && (
            <div className="mt-2">
              {visibleExpired.map((d) => (
                <DealRow
                  key={d.id}
                  row={{
                    letter: (d.title[0] ?? "•").toUpperCase(),
                    tile: DEAL_TILE_CLASSES.expired,
                    title: d.title,
                    price: d.price,
                    meta: ["Expired", dealMetaLine(d)].filter(Boolean).join(" · "),
                    isCopy: d.isCopy,
                    href: `${base}?holiday=${d.kind}:${d.id}`,
                    testId: `client-expired-deal-${d.id}`,
                  }}
                />
              ))}
              {expiredDeals.length > EXPIRED_PREVIEW_LIMIT && !showAllExpired && (
                <button
                  type="button"
                  onClick={() => setShowAllExpired(true)}
                  className="px-1.5 py-1 text-[12px] font-medium text-social-muted hover:text-foreground"
                  data-testid="client-expired-deals-show-all"
                >
                  Show all
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
