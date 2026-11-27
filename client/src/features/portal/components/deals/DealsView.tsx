import { useState } from "react";
import { useLocation } from "wouter";
import {
  usePortalDealFilters,
  usePortalDeals,
  usePortalForYouDeals,
  usePortalHasTags,
  usePortalMyTags,
  type PortalDeal,
} from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { usePortalSummary } from "../../api/use-portal-summary";
import {
  DEFAULT_DEAL_FILTERS,
  dealsEmptyKind,
  hasExplicitFilter,
  initialDealsTab,
  isFilteringByInterests,
  selectCountry,
  selectTag,
  type DealFilters,
  type DealsTab,
} from "../../lib/deals";
import { agentFirstName } from "../../lib/quote-format";
import { isTold, rememberTold, toldClientKey, toldThisSession } from "../../lib/told-deals";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, PortalButton, PortalHero, PortalSection } from "../brand";
import { DealCard } from "./DealCard";
import { DealsFilters } from "./DealsFilters";

const TAB =
  "min-h-12 flex-1 border-b-2 px-2 text-xs font-normal uppercase tracking-[0.2em] transition-colors";

/** The Deals tab: a modest hero, the two lists (Latest deals, For you), their filters and the cards. */
export function DealsView() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<DealFilters>(DEFAULT_DEAL_FILTERS);
  const [tab, setTab] = useState<DealsTab>(() => initialDealsTab(window.location.search));
  const branding = usePortalBrandingValue();
  const agent = agentFirstName(branding.agentName);

  const { data: hasTagsData, isLoading: hasTagsLoading } = usePortalHasTags();
  const hasInterests = hasTagsData?.hasTags ?? false;
  const myTags = usePortalMyTags();
  const interestNames = (myTags.data ?? []).map((t) => t.name);

  const isForYou = tab === "for-you";
  const filteringByInterests = isFilteringByInterests(tab, hasInterests, filters);

  // Hold the deals fetch off until we know whether the customer has saved interests, so the list is not fetched
  // unfiltered and then again filtered.
  const latest = usePortalDeals(filters.country, filters.tag, filters.matchInterests && hasInterests, !hasTagsLoading);
  const forYou = usePortalForYouDeals();
  const dealFilters = usePortalDealFilters();
  const summary = usePortalSummary();
  const toldDealIds = summary.data?.toldDealIds ?? [];
  // Deals told in this session, so the card flips after a successful tap even if the summary has not loaded.
  const clientKey = toldClientKey(localStorage.getItem("portal_client_id"));
  const [sessionTold, setSessionTold] = useState<ReadonlySet<string>>(() => toldThisSession(clientKey));
  const markTold = (dealId: string) => {
    rememberTold(clientKey, dealId);
    setSessionTold(toldThisSession(clientKey));
  };

  const active = isForYou ? forYou : latest;
  const deals: PortalDeal[] = active.data ?? [];
  const loading = isForYou ? forYou.isLoading : hasTagsLoading || latest.isLoading;
  const failed = active.isError && deals.length === 0;
  const forYouCount = forYou.data?.length ?? 0;

  const popularTags = (dealFilters.data?.popularTags ?? []).map((t) => t.tag);
  const countries = dealFilters.data?.countries ?? [];
  const clearFilters = () => setFilters(DEFAULT_DEAL_FILTERS);

  return (
    <div data-testid="portal-deals">
      <PortalHero className="h-[480px] md:h-[480px]">
        <Eyebrow className="text-accent">Holiday deals</Eyebrow>
        <h1 className="portal-serif text-[44px] font-light leading-none text-white" data-testid="text-deals-title">
          {isForYou ? "Picked" : "Latest"}
          <br />
          <em className="italic">{isForYou ? "for you." : "deals."}</em>
        </h1>
      </PortalHero>

      <PortalSection className="pb-14 pt-4">
        <div className="flex items-end gap-3">
          <div role="tablist" aria-label="Deals" className="flex flex-1 border-b border-border" data-testid="tabs-deals">
            <button
              type="button"
              role="tab"
              aria-selected={!isForYou}
              onClick={() => setTab("latest")}
              className={cn(TAB, !isForYou ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary")}
              data-testid="tab-deals-latest"
            >
              Latest deals
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isForYou}
              onClick={() => setTab("for-you")}
              className={cn(TAB, isForYou ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary")}
              data-testid="tab-deals-for-you"
            >
              For you
              {forYouCount > 0 && (
                <span className="ml-2 inline-block min-w-[20px] bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-foreground" data-testid="count-deals-for-you">
                  {forYouCount}
                </span>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void active.refetch()}
            className="min-h-12 px-1 text-[11px] font-normal uppercase tracking-[0.2em] text-primary hover:portal-text-amber-ink"
            data-testid="button-refresh-deals"
          >
            Refresh
          </button>
        </div>

        {!isForYou && (
          <div className="pt-6">
            <DealsFilters
              popularTags={popularTags}
              countries={countries}
              selectedTag={filters.tag}
              selectedCountry={filters.country}
              showInterestsToggle={hasInterests && !filters.tag}
              matchInterests={filters.matchInterests}
              canClear={hasExplicitFilter(filters)}
              onToggleInterests={() => setFilters((f) => ({ ...f, matchInterests: !f.matchInterests }))}
              onTag={(tag) => setFilters((f) => selectTag(f, tag))}
              onCountry={(country) => setFilters((f) => selectCountry(f, country))}
              onClear={clearFilters}
            />
          </div>
        )}

        <div className="pt-8">
          {loading ? (
            <DealsLoading />
          ) : failed ? (
            <div role="alert" className="py-10 text-center" data-testid="deals-error">
              <p className="portal-serif text-[26px] text-primary">We couldn&apos;t load the deals.</p>
              <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
              <PortalButton variant="outline" className="mt-5" onClick={() => void active.refetch()} data-testid="button-deals-retry">
                Try again
              </PortalButton>
            </div>
          ) : deals.length === 0 ? (
            <DealsEmpty kind={dealsEmptyKind(tab, filteringByInterests, filters)} onClear={clearFilters} onBrowseAll={() => setFilters((f) => ({ ...f, matchInterests: false }))} onInterests={() => setLocation("/portal/tags")} />
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2" data-testid="deals-list">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} interests={interestNames} agent={agent} told={isTold(deal.id, toldDealIds, sessionTold)} onTold={markTold} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex">
          <PortalButton variant="outline" className="w-full sm:w-auto" onClick={() => setLocation("/portal/tags")} data-testid="link-travel-interests">
            Travel interests
          </PortalButton>
        </div>
      </PortalSection>
    </div>
  );
}

function DealsLoading() {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2" role="status" aria-label="Loading deals" data-testid="deals-loading">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-[240px] bg-secondary" />
          <div className="mt-4 h-4 w-1/3 bg-secondary" />
          <div className="mt-3 h-8 w-3/4 bg-secondary" />
          <div className="mt-3 h-4 w-1/2 bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function DealsEmpty({
  kind,
  onClear,
  onBrowseAll,
  onInterests,
}: {
  kind: "for-you" | "filters" | "interests" | "none";
  onClear: () => void;
  onBrowseAll: () => void;
  onInterests: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center" data-testid="deals-empty">
      {kind === "for-you" && (
        <>
          {/* For you is empty both when no tags are saved and when nothing live matches them; tags are the one thing to act on. */}
          <p className="portal-serif text-[28px] leading-tight text-primary" data-testid="text-empty-deals">
            Nothing for you just yet
          </p>
          <p className="mt-2 max-w-[320px] text-[15px] text-muted-foreground">Pick the holidays you like and we&apos;ll match deals to you.</p>
          <PortalButton className="mt-6" onClick={onInterests} data-testid="button-empty-for-you-tags">
            Choose your interests
          </PortalButton>
        </>
      )}
      {kind === "filters" && (
        <>
          <p className="portal-serif text-[28px] leading-tight text-primary" data-testid="text-empty-deals">
            No deals match
          </p>
          <p className="mt-2 max-w-[320px] text-[15px] text-muted-foreground">Nothing fits those filters right now.</p>
          <PortalButton className="mt-6" onClick={onClear} data-testid="button-empty-clear-filters">
            Clear filters
          </PortalButton>
        </>
      )}
      {kind === "interests" && (
        <>
          <p className="portal-serif text-[28px] leading-tight text-primary" data-testid="text-empty-deals">
            No deals match your travel interests yet
          </p>
          <p className="mt-2 max-w-[320px] text-[15px] text-muted-foreground">Try browsing all deals, or update what you&apos;re into.</p>
          <div className="mt-6 flex w-full max-w-[320px] flex-col gap-3">
            <PortalButton variant="outline" onClick={onBrowseAll} data-testid="button-empty-latest-browse-all">
              Browse all deals
            </PortalButton>
            <PortalButton onClick={onInterests} data-testid="button-empty-latest-edit-interests">
              Edit interests
            </PortalButton>
          </div>
        </>
      )}
      {kind === "none" && (
        <>
          <p className="portal-serif text-[28px] leading-tight text-primary" data-testid="text-empty-deals">
            No deals available
          </p>
          <p className="mt-2 max-w-[320px] text-[15px] text-muted-foreground">Check back soon for new holiday deals.</p>
        </>
      )}
    </div>
  );
}
