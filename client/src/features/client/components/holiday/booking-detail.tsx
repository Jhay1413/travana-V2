import { useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { PhotoViewer } from "@/components/shared/photo-viewer";
import { useBooking, useQuote } from "@/hooks/queries";
import { CruiseItinerary } from "@/features/quote/components/CruiseItinerary";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import { buildQuoteLikeFields } from "@/features/client/components/holiday-fields";
import { isPrimaryQuote } from "@/features/client/components/client-types";
import { factRows } from "@/features/client/lib/holiday-facts";
import { ActivityCard } from "@/features/client/components/holiday/activity-card";
import { FactsCard } from "@/features/client/components/holiday/facts-card";
import { Hero } from "@/features/client/components/holiday/hero";
import { HolidayMessage, HolidayPageShell } from "@/features/client/components/holiday/holiday-page-shell";
import { firstNameOf, type HolidayDetailBaseProps } from "@/features/client/components/holiday/holiday-detail.types";
import { StageBox } from "@/features/client/components/holiday/stage-box";
import { TopBar } from "@/features/client/components/holiday/top-bar";
import { TripCostingsCard } from "@/features/client/components/holiday/trip-costings-card";
import { useHolidayPhotos } from "@/features/client/components/holiday/use-holiday-photos";
import { ViewsCard } from "@/features/client/components/holiday/views-card";

/**
 * The booking page: hero, references, details and money, activity and the
 * "how this booking happened" box. The views and stage steps come from the
 * quote the booking was made from (same deal), when the client page has it.
 */
export function BookingDetail(props: HolidayDetailBaseProps) {
  const { id, clientId, clientName, clientPhone, clientBadge, readOnly, onOpenExpiryDialog, onDeleted, quotes } = props;
  const { data: raw, isLoading, error } = useBooking(id);
  const display = useMemo(() => (raw ? transformQuoteData(raw) : null), [raw]);
  const photos = useHolidayPhotos(raw);
  const [editOpen, setEditOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // The booking links to the quote it came from; fall back to the deal's quote when it does not.
  const fallbackQuoteId = useMemo(() => {
    if (!raw || raw.quote_id) return "";
    const sameDeal = quotes.filter((q) => q.transaction_id === raw.transaction_id);
    return (sameDeal.find((q) => isPrimaryQuote(q)) ?? sameDeal[0])?.id ?? "";
  }, [raw, quotes]);
  const sourceQuoteId = raw?.quote_id || fallbackQuoteId;
  const { data: sourceQuote } = useQuote(sourceQuoteId);
  const openEdit = () => setEditOpen(true);

  const topBar = (
    <TopBar
      mode="booking"
      clientId={clientId}
      clientName={clientName}
      clientPhone={clientPhone}
      clientBadge={clientBadge}
      selection={{ type: "booking", id }}
      bookingData={raw}
      sourceQuoteId={sourceQuoteId || null}
      sourceQuoteToken={sourceQuote?.quote_token ?? null}
      readOnly={readOnly}
      editOpen={editOpen}
      onEditOpenChange={setEditOpen}
      onConvert={() => undefined}
      onOpenExpiryDialog={onOpenExpiryDialog}
      onDeleted={onDeleted}
    />
  );

  if (isLoading) {
    return (
      <>
        <HolidayPageShell
          topBar={topBar}
          main={
            <HolidayMessage>
              <Spinner className="mx-auto h-8 w-8" />
            </HolidayMessage>
          }
        />
      </>
    );
  }
  if (error || !raw || !display) {
    return (
      <>
        <HolidayPageShell topBar={topBar} main={<HolidayMessage>Unable to load this holiday.</HolidayMessage>} />
      </>
    );
  }

  const hasCruise = (display.cruise?.itinerary?.length ?? 0) > 0;

  return (
    <>
      <HolidayPageShell
        topBar={topBar}
        main={
          <>
            <Hero display={display} raw={raw} mode="booking" photos={photos} readOnly={readOnly} onOpenPhoto={setViewerIndex} />
            <FactsCard fields={factRows(buildQuoteLikeFields(display))} readOnly={readOnly} onEdit={openEdit} />
            {hasCruise && display.cruise && <CruiseItinerary itinerary={display.cruise.itinerary} />}
            <ActivityCard
              transactionId={raw.transaction_id}
              entityId={id}
              entityType="booking"
              clientId={clientId}
              clientName={clientName}
              readOnly={readOnly}
            />
            <StageBox
              mode="booking"
              quoteId={sourceQuoteId}
              createdAt={sourceQuote?.date_created ?? raw.date_created}
              sentAt={sourceQuote?.quote_sent_at}
              sentVia={sourceQuote?.quote_sent_via}
              acceptedAt={sourceQuote?.accepted_at}
              acceptedByName={sourceQuote?.accepted_by_name}
              isBooked
              bookedAt={raw.date_created}
              readOnly={readOnly}
              clientFirstName={firstNameOf(clientName)}
            />
          </>
        }
        side={
          <>
            <TripCostingsCard display={display} raw={raw} mode="booking" onEdit={readOnly ? undefined : openEdit} />
            {sourceQuoteId && <ViewsCard quoteId={sourceQuoteId} sentAt={sourceQuote?.quote_sent_at} />}
          </>
        }
      />
      <PhotoViewer
        images={photos}
        open={viewerIndex !== null}
        index={viewerIndex ?? 0}
        title={display.accommodation.property || display.quoteTitle || "Booking"}
        onIndexChange={setViewerIndex}
        onOpenChange={(open) => !open && setViewerIndex(null)}
      />
    </>
  );
}
