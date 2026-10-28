import { AlertTriangle, BedDouble, CalendarDays, Check, Eye, Users } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { formatUKDate, type QuoteDisplay } from "@/features/quote/components/quote-types";
import { QuoteExpiryPill } from "@/features/quote/components/QuoteExpiryPill";
import { useLiveNow } from "@/features/quote/components/hooks";
import { getQuoteExpiryInfo } from "@/features/quote/lib/quote-expiry";
import { useQuoteViews } from "@/features/quote/api/use-quote-share-queries";
import { timeAgo } from "@/features/quote/lib/quote-views";
import type { EnrichedBooking, EnrichedQuote } from "@/features/quote/types";
import { formatQuotePassengers } from "@/features/client/components/holiday-fields";
import { gbp2 } from "@/features/client/lib/holiday-format";
import type { MosaicImage } from "@/features/client/lib/hero-mosaic";
import { RefChips } from "@/features/client/components/holiday/ref-chips";
import { HeroMosaic } from "@/features/client/components/holiday/hero-mosaic";
import { HOLIDAY_BTN } from "@/features/client/components/holiday/holiday-styles";

/**
 * Hero card of a quote or booking: photo mosaic, meta line, highlight pills, price block and,
 * for an expired quote, the expired banner with "Extend expiry".
 *
 * Props:
 * - display: transformQuoteData(raw), already computed by the page.
 * - raw: the quote or booking detail response (operator name / logo, expiry dates, id).
 * - mode: "quote" shows expiry and views; "booking" shows the green Booked pill instead.
 * - photos: photos in viewer order (useHolidayPhotos(raw)).
 * - stars: hotel star rating when known; omitted otherwise.
 * - readOnly: hides the Extend expiry button and the expiry refresh icon.
 * - onOpenPhoto: index into `photos` of the clicked mosaic tile; the page opens its PhotoViewer.
 * - onExtendExpiry: opens the page's shared Update Expiry dialog (quote only).
 */
export interface HeroProps {
  display: QuoteDisplay;
  raw: EnrichedQuote | EnrichedBooking;
  mode: "quote" | "booking";
  photos: MosaicImage[];
  stars?: number | null;
  readOnly?: boolean;
  onOpenPhoto: (index: number) => void;
  onExtendExpiry?: () => void;
}

function ViewsPill({ quoteId }: { quoteId: string }) {
  const { data } = useQuoteViews(quoteId);
  const now = useLiveNow();
  if (!data || data.totalViews === 0) return null;
  const ago = timeAgo(data.lastViewed, now) || null;
  return (
    <StatusPill tone="plain" className="gap-1" >
      <Eye className="size-3" aria-hidden /> {data.totalViews}
      {ago ? ` · ${ago}` : ""}
    </StatusPill>
  );
}

export function Hero({ display, raw, mode, photos, stars, readOnly = false, onOpenPhoto, onExtendExpiry }: HeroProps) {
  const now = useLiveNow();
  const isQuote = mode === "quote";
  const quote = isQuote ? (raw as EnrichedQuote) : null;
  const isLost = isQuote && display.status === "lost";
  const expiryInfo = quote && !isLost ? getQuoteExpiryInfo(quote.date_expiry, quote.date_created, now) : null;
  const isExpired = expiryInfo?.status === "expired";
  const title = display.quoteTitle || (isQuote ? "Untitled quote" : "Untitled booking");
  const place = [display.destinationName || display.destination, display.countryName].filter(Boolean).join(", ");
  const pax = formatQuotePassengers(display);
  const total = display.commissions.price;
  const nightsLine = [display.nights ? `${display.nights} nights` : null, display.accommodation.board || null].filter(Boolean).join(", ");

  return (
    <section className="overflow-hidden rounded-2xl border border-social-border bg-card" aria-labelledby="holiday-hero-title" data-testid="holiday-hero">
      <HeroMosaic
        photos={photos}
        title={title}
        place={place}
        operatorName={raw.main_tour_operator_name ?? null}
        operatorLogoUrl={raw.main_tour_operator_logo_url ?? null}
        stars={stars}
        onOpenPhoto={onOpenPhoto}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-4 px-[22px] pb-[22px] pt-5 max-[620px]:grid-cols-1 max-[620px]:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-qp-muted">
            {display.travelDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                {formatUKDate(display.travelDate)} to {formatUKDate(display.returnDate)}
              </span>
            )}
            {nightsLine && (
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="size-4" aria-hidden />
                {nightsLine}
              </span>
            )}
            {pax && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden />
                {pax}
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {display.packageType && <StatusPill tone="plain">{display.packageType}</StatusPill>}
            {display.transferType && <StatusPill tone="plain">{display.transferType}</StatusPill>}
            {display.isCopyQuote && <StatusPill tone="info">Copy quote</StatusPill>}
            {isLost && <StatusPill tone="bad">Lost</StatusPill>}
            {quote && (
              <QuoteExpiryPill
                dateExpiry={quote.date_expiry}
                dateCreated={quote.date_created}
                isLost={isLost}
                onUpdateExpiry={readOnly ? undefined : onExtendExpiry}
              />
            )}
            {quote && <ViewsPill quoteId={quote.id} />}
          </div>
          {!isQuote && <RefChips booking={raw as EnrichedBooking} readOnly={readOnly} />}
        </div>
        <div className="flex flex-col items-end gap-1 text-right max-[620px]:items-start max-[620px]:text-left">
          <span className="text-[32px] font-semibold leading-none tabular-nums text-social-navy">{gbp2(total)}</span>
          {display.pricePerPerson > 0 && (
            <span className="text-sm text-qp-muted">
              <b className="font-semibold text-foreground">{gbp2(display.pricePerPerson)}</b> per person{pax ? ` · ${pax}` : ""}
            </span>
          )}
          {!isQuote && (
            <StatusPill tone="good" className="mt-1.5 gap-1.5">
              <Check className="size-3.5" aria-hidden /> Booked
            </StatusPill>
          )}
        </div>
      </div>
      {isExpired && (
        <div
          className="mx-[22px] mb-[22px] flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-status-failed-bg px-3 py-2.5 text-status-failed-fg max-[620px]:mx-4"
          data-testid="holiday-detail-expired-banner"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs">
              This quote expired{quote?.date_expiry ? ` on ${formatUKDate(quote.date_expiry)}` : ""}. Extend the expiry date to keep it active.
            </p>
          </div>
          {!readOnly && onExtendExpiry && (
            <button type="button" className={HOLIDAY_BTN} onClick={onExtendExpiry} data-testid="button-extend-expiry">
              Extend expiry
            </button>
          )}
        </div>
      )}
    </section>
  );
}
