import { Check } from "lucide-react";
import { useLocation } from "wouter";
import type { PortalDeal } from "@/hooks/use-portal-api";
import { usePortalDealInterest } from "../../api/use-portal-summary";
import { dealTag, isDealExpiringSoon } from "../../lib/home";
import { formatDay, formatMoney } from "../../lib/quote-format";
import { PortalButton, SplitHeading } from "../brand";
import { HomeRail } from "./HomeRail";

interface DealsProps {
  /** Deals this customer has already told the agent about (from the server, so it follows them across devices). */
  toldDealIds: string[];
  forYou: PortalDeal[];
  latest: PortalDeal[];
  interests: string[];
  agent: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** The customer has not chosen any travel interests, so "For you" cannot exist. */
  noInterests: boolean;
}

/** Home: deals matched to the customer's interests, then the latest, each as a rail of cards; or a quiet line when there are none. */
export function HomeDeals({ toldDealIds, forYou, latest, interests, agent, loading, failed, onRetry, noInterests }: DealsProps) {
  const [, setLocation] = useLocation();
  if (loading) {
    return (
      <section className="mx-auto w-full max-w-3xl px-7 pb-6 pt-[72px]" role="status" aria-label="Loading deals" data-testid="home-deals-loading">
        <div className="mb-5 h-9 w-1/2 animate-pulse bg-secondary" />
        <div className="flex gap-3.5 overflow-hidden">
          {[0, 1].map((i) => (
            <div key={i} className="h-[380px] w-[260px] flex-none animate-pulse bg-secondary" />
          ))}
        </div>
      </section>
    );
  }

  const nothing = forYou.length === 0 && latest.length === 0;

  return (
    <>
      {forYou.length > 0 && (
        <HomeRail id="home-for-you" eyebrow="Matched to your interests" lead="For" italic="you" label="Deals for you" testId="home-for-you">
          {forYou.map((d) => (
            <DealCard key={d.id} deal={d} interests={interests} agent={agent} told={toldDealIds.includes(d.id)} />
          ))}
        </HomeRail>
      )}

      {latest.length > 0 && (
        <HomeRail
          id="home-latest-deals"
          eyebrow="Our latest deals"
          lead="Lately,"
          italic="for you"
          label="Latest deals"
          testId="home-latest-deals"
        >
          {latest.map((d) => (
            <DealCard key={d.id} deal={d} interests={interests} agent={agent} told={toldDealIds.includes(d.id)} />
          ))}
        </HomeRail>
      )}

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-7 pb-2 pt-10" data-testid="home-deals-footer">
        {failed && nothing && (
          <p role="alert" className="text-[15px] text-muted-foreground" data-testid="home-deals-error">
            We couldn&apos;t load the deals.{" "}
            <button type="button" className="min-h-11 text-primary underline underline-offset-4" onClick={onRetry} data-testid="home-deals-retry">
              Try again
            </button>
          </p>
        )}
        {!failed && nothing && (
          <>
            <SplitHeading as="h2" lead="Deals" italic="soon." className="text-[34px] leading-[1.08]" />
            <p className="text-[15px] text-muted-foreground" data-testid="home-deals-empty">
              No new deals right now. Check back soon.
            </p>
          </>
        )}
        {noInterests && (
          <p className="text-[15px] text-muted-foreground" data-testid="home-interests-nudge">
            Tell us what you love and we&apos;ll show deals picked for you.{" "}
            <button type="button" className="min-h-11 text-primary underline underline-offset-4" onClick={() => setLocation("/portal/tags")} data-testid="home-interests-link">
              Choose your travel interests
            </button>
          </p>
        )}
        <div className="flex">
          <PortalButton variant="outline" className="w-full sm:w-auto" onClick={() => setLocation("/portal/deals")} data-testid="home-browse-deals">
            Browse all deals
          </PortalButton>
        </div>
      </section>
    </>
  );
}

function DealCard({ deal, interests, agent, told }: { deal: PortalDeal; interests: string[]; agent: string; told: boolean }) {
  const [, setLocation] = useLocation();
  const interest = usePortalDealInterest();
  const tag = dealTag(deal.tags ?? [], interests);
  const when = formatDay(deal.travel_date);
  const detail = [when, deal.num_nights ? `${deal.num_nights} nights` : ""].filter(Boolean).join(" · ");
  const expiring = isDealExpiringSoon(deal.portal_added_at);

  const tell = () => interest.mutate(deal.id);

  return (
    <article className="flex w-[260px] flex-none snap-start flex-col gap-3" data-testid={`home-deal-${deal.id}`}>
      <div className="relative h-[320px] w-[260px] overflow-hidden bg-[hsl(var(--portal-navy-deep))]">
        {deal.image_url && <img src={deal.image_url} alt="" loading="lazy" className="size-full object-cover" />}
      </div>
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground" data-testid={`home-deal-tag-${deal.id}`}>
          {tag}
        </span>
        {expiring && (
          <span className="portal-serif flex-none text-[15px] italic portal-text-amber-ink" data-testid={`home-deal-expiring-${deal.id}`}>
            Expiring soon
          </span>
        )}
      </div>
      <h3 className="portal-serif break-words text-[24px] leading-[1.15] text-primary">{deal.title}</h3>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        {deal.destination}
        {detail && (
          <>
            <br />
            {detail}
          </>
        )}
      </p>
      {deal.price > 0 && (
        <p className="text-[15px] text-muted-foreground">
          from <span className="portal-serif text-[26px] portal-text-ink">{formatMoney(deal.price)}</span>
        </p>
      )}
      {told ? (
        <p
          role="status"
          className="mt-1 flex min-h-[52px] items-center justify-center gap-2.5 border border-border px-2 text-center text-xs uppercase tracking-[0.2em] portal-text-amber-ink"
          data-testid={`deal-told-${deal.id}`}
        >
          <Check className="size-4 flex-none" strokeWidth={1.5} aria-hidden /> {agent === "your agent" ? "Your agent has" : `${agent} has`} been told
        </p>
      ) : (
        <PortalButton variant="outline" className="mt-1 w-full px-4" disabled={interest.isPending} onClick={tell} data-testid={`button-deal-interest-${deal.id}`}>
          I&apos;m interested
        </PortalButton>
      )}
      {interest.isError && (
        <p role="alert" className="portal-text-danger text-[15px]">
          That didn&apos;t send. Please try again.
        </p>
      )}
      {deal.quote_url && (
        <PortalButton variant="link" className="self-start text-[11px]" onClick={() => setLocation(deal.quote_url ?? "/portal/deals")} data-testid={`home-view-deal-${deal.id}`}>
          View deal →
        </PortalButton>
      )}
    </article>
  );
}
