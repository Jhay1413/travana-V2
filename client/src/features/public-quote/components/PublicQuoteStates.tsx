import type { ReactNode } from "react";
import { Eyebrow, PortalButton, PortalHero, PortalSection, SplitHeading, portalButtonClass, type PortalBranding } from "@/features/portal";
import type { PublicQuoteBlock } from "@/features/quote/api/use-quote-public-queries";
import { telHref } from "../lib/public-quote";
import { PublicQuoteShell } from "./PublicQuoteShell";

/** A plain navy hero, the agency's mark above it (from the shell) and the message in the middle of it. */
function MessageHero({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId}>
      <PortalHero className="h-[460px] md:h-[460px]" contentClassName="gap-4">
        {children}
      </PortalHero>
    </div>
  );
}

/** A quote that cannot be opened by its link: says nothing about why, or about what the quote was. */
export function PublicQuoteBlocked({ block, branding, staffPreview = false }: { block: PublicQuoteBlock; branding: PortalBranding; staffPreview?: boolean }) {
  const { agency } = block;
  if (block.code === "BOOKED") {
    return (
      <PublicQuoteShell branding={branding} staffPreview={staffPreview}>
        <MessageHero testId="blocked-quote-booked">
          <h1 className="portal-serif w-full text-[40px] font-light leading-[1.08] text-white [overflow-wrap:anywhere]" data-testid="text-blocked-title">
            This holiday has been booked.
          </h1>
          <a href="/portal/bookings" className={portalButtonClass("amber", "mt-2")} data-testid="link-view-in-portal">
            View it in your portal
          </a>
        </MessageHero>
      </PublicQuoteShell>
    );
  }
  return (
    <PublicQuoteShell branding={branding} staffPreview={staffPreview}>
      <MessageHero testId="blocked-quote-unavailable">
        <h1 className="portal-serif w-full text-[40px] font-light leading-[1.08] text-white [overflow-wrap:anywhere]" data-testid="text-blocked-title">
          This quote is no longer available.
        </h1>
        <p className="text-[15px] leading-[1.7] text-white/[0.82]" data-testid="text-blocked-contact">
          {agency.name ? `Please contact ${agency.name}.` : "Please contact your travel advisor."}
        </p>
        {agency.phone && (
          <a href={telHref(agency.phone)} className={portalButtonClass("light", "mt-1")} data-testid="link-blocked-phone">
            {agency.phone}
          </a>
        )}
      </MessageHero>
    </PublicQuoteShell>
  );
}

/** The link is wrong (404): the agency is not known, so nothing about one is shown. */
export function PublicQuoteNotFound({ branding }: { branding: PortalBranding }) {
  return (
    <PublicQuoteShell branding={branding}>
      <div data-testid="error-public-quote">
        <PortalSection className="py-24 text-center">
          <Eyebrow>Quote not found</Eyebrow>
          <SplitHeading as="h1" lead="We can't find" italic="that quote." className="mt-3 text-[40px] leading-[1.08]" />
          <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
            This quote link may have expired or is no longer available. Please contact your travel advisor for assistance.
          </p>
        </PortalSection>
      </div>
    </PublicQuoteShell>
  );
}

/** Something went wrong loading it (a dropped connection, a server error): the visitor can try again. */
export function PublicQuoteLoadError({ branding, onRetry }: { branding: PortalBranding; onRetry: () => void }) {
  return (
    <PublicQuoteShell branding={branding}>
      <div data-testid="error-public-quote-load">
        <PortalSection className="py-24 text-center">
          <p role="alert" className="portal-serif text-[28px] text-primary">
            We couldn&apos;t load this quote.
          </p>
          <PortalButton variant="outline" className="mt-5" onClick={onRetry} data-testid="button-retry-quote">
            Try again
          </PortalButton>
        </PortalSection>
      </div>
    </PublicQuoteShell>
  );
}

/** Skeleton while the quote loads (the same blocks as the portal's). */
export function PublicQuoteLoading({ branding }: { branding: PortalBranding }) {
  return (
    <PublicQuoteShell branding={branding}>
      <div className="animate-pulse" role="status" aria-label="Loading your quote" data-testid="loading-public-quote">
        <div className="h-[320px] bg-secondary" />
        <div className="mx-auto mt-8 max-w-3xl space-y-4 px-7">
          <div className="h-4 w-1/3 bg-secondary" />
          <div className="h-10 w-3/4 bg-secondary" />
          <div className="h-4 w-1/2 bg-secondary" />
        </div>
      </div>
    </PublicQuoteShell>
  );
}
