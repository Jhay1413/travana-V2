import { ArrowRight, Check } from "lucide-react";
import type { PortalDeal } from "@/hooks/use-portal-api";
import { usePortalDealInterest } from "../../api/use-portal-summary";
import { dealTag, isDealExpiringSoon } from "../../lib/home";
import { formatDay, formatMoney } from "../../lib/quote-format";
import { PortalButton, portalButtonClass } from "../brand";

/**
 * One deal on the Deals page. The same card as Home's rail (photo, tag, title, place, "from" price, "I'm interested",
 * the server's told state), but it fills its grid cell instead of being a fixed-width rail card.
 * The price is the stored figure: it is never labelled "per person".
 */
export function DealCard({ deal, interests, agent, told, onTold }: { deal: PortalDeal; interests: string[]; agent: string; told: boolean; onTold: (dealId: string) => void }) {
  const interest = usePortalDealInterest();
  const tag = dealTag(deal.tags ?? [], interests);
  const when = formatDay(deal.travel_date);
  const detail = [when, deal.num_nights ? `${deal.num_nights} nights` : ""].filter(Boolean).join(" · ");
  const expiring = isDealExpiringSoon(deal.portal_added_at);

  return (
    <article className="flex min-w-0 flex-col gap-3 border-b border-border pb-9" data-testid={`card-deal-${deal.id}`}>
      <div className="relative h-[240px] w-full overflow-hidden bg-[hsl(var(--portal-navy-deep))]">
        {deal.image_url && <img src={deal.image_url} alt="" loading="lazy" className="size-full object-cover" data-testid={`img-deal-${deal.id}`} />}
      </div>
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground" data-testid={`tag-deal-${deal.id}`}>
          {tag}
        </span>
        {expiring && (
          <span className="portal-serif flex-none text-[15px] italic portal-text-amber-ink" data-testid={`deal-expiring-${deal.id}`}>
            Expiring soon
          </span>
        )}
      </div>
      <h3 className="portal-serif max-w-full text-[26px] leading-[1.15] text-primary [overflow-wrap:anywhere]" data-testid={`text-deal-title-${deal.id}`}>
        {deal.title}
      </h3>
      <p className="max-w-full text-[15px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {deal.destination}
        {deal.hotel && (
          <>
            <br />
            {deal.hotel}
          </>
        )}
        {detail && (
          <>
            <br />
            {detail}
          </>
        )}
      </p>
      {deal.price > 0 && (
        <p className="text-[15px] text-muted-foreground" data-testid={`price-deal-${deal.id}`}>
          from <span className="portal-serif text-[28px] portal-text-ink">{formatMoney(deal.price)}</span>
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
        <PortalButton
          variant="outline"
          className="mt-1 w-full px-4"
          disabled={interest.isPending}
          onClick={() => interest.mutate(deal.id, { onSuccess: () => onTold(deal.id) })}
          data-testid={`button-interest-${deal.id}`}
        >
          I&apos;m interested
        </PortalButton>
      )}
      {interest.isError && (
        <p role="alert" className="portal-text-danger text-[13px]">
          That didn&apos;t send. Please try again.
        </p>
      )}
      {deal.quote_url && (
        <a href={deal.quote_url} className={portalButtonClass("link", "self-start text-[11px]")} data-testid={`button-view-deal-${deal.id}`}>
          View deal <ArrowRight strokeWidth={1.5} aria-hidden />
        </a>
      )}
    </article>
  );
}
