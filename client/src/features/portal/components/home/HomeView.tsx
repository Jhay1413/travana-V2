import { useState } from "react";
import { usePortalForYouDeals, usePortalLatestDeals, usePortalMyTags, usePortalUser } from "@/hooks/use-portal-api";
import { usePortalSummary } from "../../api/use-portal-summary";
import { usePortalQuoteList } from "../../api/use-portal-quotes";
import { heroPhoto, homeSections, mergeDeals } from "../../lib/home";
import { splitQuotes } from "../../lib/quote-decision";
import { agentFirstName } from "../../lib/quote-format";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { PortalButton, PortalHero, PortalSection } from "../brand";
import { HomeDeals } from "./HomeDeals";
import { HomeQuotesRail } from "./HomeQuotesRail";
import { HomeAgentBlock, HomeComingUp, HomeHero, HomeNextJourney, HomeRequestQuote, HomeSummaryRows } from "./HomeSections";
import { RequestQuoteSheet } from "./RequestQuoteSheet";

const FIRST_TIME_LINE = "Welcome. Tell us where you would like to go and we will put a holiday together for you.";

/** The portal Home: greeting, what is coming up, quotes, deals and the agent. */
export function HomeView() {
  const summary = usePortalSummary();
  const quotesQuery = usePortalQuoteList();
  const user = usePortalUser();
  const forYou = usePortalForYouDeals();
  const latest = usePortalLatestDeals();
  const tags = usePortalMyTags();
  const branding = usePortalBrandingValue();
  const agent = agentFirstName(branding.agentName);
  const [requestOpen, setRequestOpen] = useState(false);

  if (summary.isLoading || quotesQuery.isLoading) return <HomeLoading />;
  if (summary.isError || !summary.data) {
    return (
      <HomeShell>
        <div role="alert" className="mx-auto max-w-3xl px-7 py-16 text-center" data-testid="home-error">
          <p className="portal-serif text-[28px] text-primary">We couldn&apos;t load your home page.</p>
          <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
          <PortalButton
            variant="outline"
            className="mt-5"
            onClick={() => {
              void summary.refetch();
              void quotesQuery.refetch();
            }}
            data-testid="button-home-retry"
          >
            Try again
          </PortalButton>
        </div>
      </HomeShell>
    );
  }

  const now = new Date();
  const data = summary.data;
  // The list is unknown (not empty) when it could not load, so a failed load never looks like a first visit.
  const quotes = quotesQuery.isSuccess ? quotesQuery.data : undefined;
  const interestNames = (tags.data ?? []).map((t) => t.name);
  const deals = mergeDeals(forYou.data ?? [], latest.data ?? []);
  const sections = homeSections({
    summary: data,
    quotes,
    forYouCount: deals.forYou.length,
    latestCount: deals.latest.length,
    interestCount: tags.isSuccess ? interestNames.length : 1,
  });
  const railQuotes = splitQuotes(quotes ?? []).active;

  const dealsBlock = (
    <HomeDeals
      toldDealIds={data.toldDealIds}
      forYou={deals.forYou}
      latest={deals.latest}
      interests={interestNames}
      agent={agent}
      loading={forYou.isLoading || latest.isLoading}
      failed={forYou.isError && latest.isError}
      onRetry={() => {
        void forYou.refetch();
        void latest.refetch();
      }}
      noInterests={sections.interestsNudge}
    />
  );

  return (
    <HomeShell>
      <HomeHero summary={data} lastName={user.data?.lastName ?? null} agent={agent} photo={heroPhoto(data, quotes ?? [])} now={now} />

      {sections.firstTime ? (
        <>
          <HomeRequestQuote onOpen={() => setRequestOpen(true)} intro={FIRST_TIME_LINE} />
          {dealsBlock}
        </>
      ) : (
        <>
          <HomeComingUp summary={data} sections={sections} />
          <HomeSummaryRows summary={data} sections={sections} agent={agent} />
          {data.nextBooking && <HomeNextJourney booking={data.nextBooking} />}
          {sections.quotesRail && <HomeQuotesRail quotes={railQuotes} />}
          {dealsBlock}
          <HomeRequestQuote onOpen={() => setRequestOpen(true)} />
        </>
      )}

      <HomeAgentBlock branding={branding} agent={agent} />
      <RequestQuoteSheet open={requestOpen} onOpenChange={setRequestOpen} agent={agent} />
    </HomeShell>
  );
}

function HomeShell({ children }: { children: React.ReactNode }) {
  return <div data-testid="portal-home">{children}</div>;
}

function HomeLoading() {
  return (
    <div data-testid="portal-home" aria-busy="true">
      <PortalHero className="min-h-[260px]">
        <div role="status" aria-label="Loading your home page" className="flex flex-col items-center gap-4" data-testid="home-loading">
          <div className="h-3 w-28 animate-pulse bg-white/20" />
          <div className="h-12 w-56 animate-pulse bg-white/20" />
          <div className="h-4 w-60 animate-pulse bg-white/15" />
        </div>
      </PortalHero>
      <PortalSection className="flex flex-col gap-6 pb-14 pt-12" aria-hidden>
        <div className="h-36 animate-pulse bg-secondary" />
        <div className="h-24 animate-pulse bg-secondary" />
        <div className="h-24 animate-pulse bg-secondary" />
      </PortalSection>
    </div>
  );
}
