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
        <PortalButton variant="link" className="text-[11px] tracking-[0.24em] text-muted-foreground" onClick={() => setLocation("/portal/quotes")} data-testid="home-quotes-see-all">
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
      className="group flex w-[260px] min-w-0 flex-none snap-start flex-col gap-3.5 text-left"
      data-testid={`home-quote-${q.id}`}
    >
      <span className="relative block h-[340px] w-[260px] overflow-hidden bg-[#0D2A4E]">
        {q.image_url && <img src={q.image_url} alt="" loading="lazy" className="size-full object-cover group-hover:brightness-[1.06]" />}
        {interested && (
          <span className="absolute left-3 top-3 bg-background px-2.5 py-[7px] text-[10px] uppercase tracking-[0.22em] portal-text-amber-ink" data-testid={`home-quote-badge-${q.id}`}>
            You&apos;re interested
          </span>
        )}
      </span>
      <span className="flex items-baseline justify-between gap-2.5 text-[11px] uppercase text-muted-foreground">
        <span className="min-w-0 tracking-[0.2em] [overflow-wrap:anywhere]">{q.destination}</span>
        {q.operator_name && <span className="min-w-0 text-right tracking-[0.18em] [overflow-wrap:anywhere]">{q.operator_name}</span>}
      </span>
      <span className="portal-serif [overflow-wrap:anywhere] text-[24px] leading-[1.15] text-primary">{title}</span>
      {dates && <span className="text-sm leading-[1.6] text-muted-foreground">{dates}</span>}
      <span className="portal-serif text-[24px] portal-text-ink">
        {formatMoney(q.price)}
        {pax && <span className="font-sans text-[13px] text-muted-foreground"> for {pax}</span>}
      </span>
    </button>
  );
}
