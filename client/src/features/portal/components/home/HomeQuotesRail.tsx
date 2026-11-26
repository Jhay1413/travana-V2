import { useLocation } from "wouter";
import type { PortalQuoteListItem } from "@shared/portal-quotes";
import { formatMoney, formatRange, paxLabel } from "../../lib/quote-format";
import { splitTitle } from "../../lib/quote-title";
import { PortalButton } from "../brand";
import { HomeRail } from "./HomeRail";

/** Home: "Your quotes", the customer's quotes still open to them as a rail of photo cards. */
export function HomeQuotesRail({ quotes }: { quotes: PortalQuoteListItem[] }) {
  const [, setLocation] = useLocation();
  return (
    <HomeRail
      id="home-quotes"
      lead="Your"
      italic="quotes"
      label="Your quotes"
      testId="home-quotes"
      action={
        <PortalButton variant="link" className="px-2 text-[11px] text-muted-foreground" onClick={() => setLocation("/portal/trips/quotes")} data-testid="home-quotes-see-all">
          See all
        </PortalButton>
      }
    >
      {quotes.map((q) => (
        <HomeQuoteCard key={q.id} quote={q} />
      ))}
    </HomeRail>
  );
}

function HomeQuoteCard({ quote: q }: { quote: PortalQuoteListItem }) {
  const [, setLocation] = useLocation();
  const { lead, italic } = splitTitle(q.title);
  const title = [lead, italic].filter(Boolean).join(" ");
  const dates = formatRange(q.travel_date, q.return_date);
  const pax = paxLabel(q.adults, q.children, q.infants);
  const interested = q.decision.state === "interested";

  return (
    <button
      type="button"
      onClick={() => setLocation(q.quote_url)}
      aria-label={`View quote: ${title}, ${dates}, ${formatMoney(q.price)}`}
      className="group flex w-[260px] flex-none snap-start flex-col gap-3 text-left"
      data-testid={`home-quote-${q.id}`}
    >
      <span className="relative block h-[300px] w-[260px] overflow-hidden bg-[hsl(var(--portal-navy-deep))]">
        {q.image_url && <img src={q.image_url} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-105" />}
        {interested && (
          <span className="absolute left-3 top-3 bg-accent px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-accent-foreground" data-testid={`home-quote-badge-${q.id}`}>
            You&apos;re interested
          </span>
        )}
      </span>
      <span className="flex justify-between gap-2.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="min-w-0 truncate">{q.destination}</span>
        {q.operator_name && <span className="min-w-0 truncate">{q.operator_name}</span>}
      </span>
      <span className="portal-serif break-words text-[24px] leading-[1.15] text-primary">{title}</span>
      {dates && <span className="text-[15px] text-muted-foreground">{dates}</span>}
      <span className="portal-serif text-[24px] leading-tight portal-text-ink">
        {formatMoney(q.price)}
        {pax && <span className="ml-1.5 font-sans text-[15px] text-muted-foreground">for {pax}</span>}
      </span>
      <span className="text-xs uppercase tracking-[0.2em] text-primary group-hover:portal-text-amber-ink">View quote →</span>
    </button>
  );
}
