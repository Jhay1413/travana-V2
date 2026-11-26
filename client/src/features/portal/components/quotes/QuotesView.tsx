import { useLocation } from "wouter";
import type { PortalQuoteListItem } from "@shared/portal-quotes";
import { usePortalQuoteAction, usePortalQuoteList } from "../../api/use-portal-quotes";
import { splitQuotes } from "../../lib/quote-decision";
import { agentFirstName, factsLine, formatMoney, formatRange, paxLabel, toRoman } from "../../lib/quote-format";
import { heldUntilLine } from "../../lib/quote-held";
import { splitTitle } from "../../lib/quote-title";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, PortalButton, PortalHero, PortalSection, SplitHeading } from "../brand";

/** Trips → Quotes: a modest photo hero, then one photo-led card per quote and a compact "Not for you" list. */
export function QuotesView() {
  const { data, isLoading, isError, refetch } = usePortalQuoteList();
  const branding = usePortalBrandingValue();
  const agent = agentFirstName(branding.agentName);
  const { active, declined } = splitQuotes(data ?? []);
  const heroPhoto = active.find((q) => q.image_url)?.image_url;

  return (
    <div data-testid="portal-quotes">
      <PortalHero className="min-h-[230px]" photoUrl={heroPhoto}>
        <Eyebrow className="portal-text-amber-soft">My quotes</Eyebrow>
        <h1 className="portal-serif text-[44px] font-light leading-none text-white">
          Put together
          <br />
          <em className="italic">for you.</em>
        </h1>
        {!isLoading && !isError && active.length > 0 && (
          <p className="max-w-[300px] text-[15px] leading-[1.6] text-white/85" data-testid="quotes-count">
            {active.length} holiday{active.length === 1 ? "" : "s"} {agent === "your agent" ? "your agent has" : `${agent} has`} prepared for you.
          </p>
        )}
      </PortalHero>

      <PortalSection className="pb-14 pt-6">
        {isLoading ? (
          <QuotesLoading />
        ) : isError ? (
          <div role="alert" className="py-10 text-center" data-testid="quotes-error">
            <p className="portal-serif text-[26px] text-primary">We couldn&apos;t load your quotes.</p>
            <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
            <PortalButton variant="outline" className="mt-5" onClick={() => void refetch()} data-testid="button-quotes-retry">
              Try again
            </PortalButton>
          </div>
        ) : active.length === 0 && declined.length === 0 ? (
          <QuotesEmpty agent={agent} />
        ) : (
          <>
            {active.length > 0 ? (
              <div className="grid gap-x-8 md:grid-cols-2" data-testid="quotes-list">
                {active.map((q, i) => (
                  <QuoteCard key={q.id} quote={q} index={i} agent={agent} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[15px] text-muted-foreground" data-testid="quotes-none-active">
                No quotes are waiting for you.
              </p>
            )}
            {declined.length > 0 && <DeclinedList quotes={declined} />}
          </>
        )}
      </PortalSection>
    </div>
  );
}

function QuotesLoading() {
  return (
    <div className="flex flex-col gap-10" role="status" aria-label="Loading your quotes" data-testid="quotes-loading">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse border-b border-border pb-9">
          <div className="h-[220px] bg-secondary" />
          <div className="mt-4 h-4 w-1/3 bg-secondary" />
          <div className="mt-3 h-8 w-3/4 bg-secondary" />
          <div className="mt-3 h-4 w-1/2 bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function QuotesEmpty({ agent }: { agent: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="py-10 text-center" data-testid="quotes-empty">
      <SplitHeading as="h2" lead="No quotes" italic="yet." className="text-[40px] leading-[1.08]" />
      <p className="mx-auto mt-3 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
        {agent === "your agent" ? "Message your agent to start planning." : `Message ${agent} to start planning.`} Your quotes will appear here.
      </p>
      <PortalButton className="mt-6" onClick={() => setLocation("/portal/messages")} data-testid="button-quotes-message">
        {agent === "your agent" ? "Send a message" : `Message ${agent}`}
      </PortalButton>
    </div>
  );
}

function QuoteCard({ quote: q, index, agent }: { quote: PortalQuoteListItem; index: number; agent: string }) {
  const [, setLocation] = useLocation();
  const held = heldUntilLine(q.expiry_date);
  const interested = q.decision.state === "interested";
  const { lead, italic } = splitTitle(q.title);
  const dates = formatRange(q.travel_date, q.return_date);
  const pax = paxLabel(q.adults, q.children, q.infants);
  const title = [lead, italic].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      onClick={() => setLocation(q.quote_url)}
      aria-label={`View ${title}, ${dates}, ${formatMoney(q.price)}`}
      className="group flex w-full flex-col gap-3.5 border-b border-border pb-9 pt-8 text-left"
      data-testid={`quote-card-${q.id}`}
    >
      <span className="flex w-full items-baseline justify-between">
        <span className="portal-serif text-[22px] portal-text-amber-ink" aria-hidden>
          {toRoman(index + 1)}
        </span>
        {q.photo_count > 0 && <span className="portal-caps-label">{q.photo_count} photo{q.photo_count === 1 ? "" : "s"}</span>}
      </span>
      <span className="relative block h-[240px] w-full overflow-hidden bg-[hsl(var(--portal-navy-deep))]">
        {q.image_url && <img src={q.image_url} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-105" />}
        {interested && (
          <span className="absolute left-3 top-3 bg-accent px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-accent-foreground" data-testid={`quote-badge-${q.id}`}>
            You&apos;re interested
          </span>
        )}
      </span>
      <span className="flex w-full justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="min-w-0 truncate">{q.destination}</span>
        {q.operator_name && <span className="min-w-0 truncate" data-testid={`quote-operator-${q.id}`}>{q.operator_name}</span>}
      </span>
      <span className="portal-serif break-words text-[30px] leading-[1.12] text-primary" data-testid={`quote-title-${q.id}`}>
        {lead}
        {italic && (
          <>
            {" "}
            <em className="italic">{italic}</em>
          </>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        {dates && <span className="text-[15px] portal-text-ink">{dates}</span>}
        <span className="text-[15px] text-muted-foreground">{factsLine(q.nights, q.board, pax)}</span>
      </span>
      <span className="flex w-full items-end justify-between gap-3 pt-1">
        <span className="flex flex-col gap-0.5">
          <span className="portal-serif text-[34px] leading-none portal-text-ink" data-testid={`quote-price-${q.id}`}>
            {formatMoney(q.price)}
          </span>
          {q.price_per_person > 0 && <span className="text-[15px] text-muted-foreground">{formatMoney(q.price_per_person)} per person</span>}
        </span>
        <span className="pb-1 text-xs uppercase tracking-[0.2em] text-primary group-hover:portal-text-amber-ink">View →</span>
      </span>
      {interested ? (
        <span className="portal-serif text-base italic portal-text-amber-ink" data-testid={`quote-status-${q.id}`}>
          {agent === "your agent" ? "Your agent has" : `${agent} has`} been told, and is checking it&apos;s still available
        </span>
      ) : (
        held && (
          <span className="portal-serif text-base italic portal-text-amber-ink" data-testid={`quote-held-${q.id}`}>
            {held.text}
          </span>
        )
      )}
    </button>
  );
}

function DeclinedList({ quotes }: { quotes: PortalQuoteListItem[] }) {
  return (
    <div className="mt-12" data-testid="quotes-declined">
      <p className="portal-eyebrow mb-3 text-muted-foreground">Not for you</p>
      <ul className="border-b border-border">
        {quotes.map((q) => (
          <DeclinedRow key={q.id} quote={q} />
        ))}
      </ul>
    </div>
  );
}

function DeclinedRow({ quote: q }: { quote: PortalQuoteListItem }) {
  const undo = usePortalQuoteAction(q.token, q.id);
  return (
    <li className="flex items-center gap-3.5 border-t border-border py-4" data-testid={`declined-row-${q.id}`}>
      {q.image_url ? (
        <img src={q.image_url} alt="" className="size-16 flex-none object-cover opacity-75" />
      ) : (
        <span aria-hidden className="size-16 flex-none bg-secondary" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="portal-serif break-words text-[19px] leading-tight text-muted-foreground">{q.title}</span>
        <span className="text-[15px] text-muted-foreground">{q.decision.reason || "No reason given"}</span>
        {undo.isError && (
          <span role="alert" className="portal-text-danger text-[15px]">
            That didn&apos;t work. Try again.
          </span>
        )}
      </div>
      <PortalButton
        variant="link"
        className="min-w-11 px-2 text-[11px]"
        disabled={undo.isPending}
        onClick={() => undo.mutate({ action: "reopened" })}
        data-testid={`button-undo-${q.id}`}
      >
        Undo
      </PortalButton>
    </li>
  );
}
