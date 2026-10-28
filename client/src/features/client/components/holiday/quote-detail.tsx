import { useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { PhotoViewer } from "@/components/shared/photo-viewer";
import { useQuote } from "@/hooks/queries";
import { CruiseItinerary } from "@/features/quote/components/CruiseItinerary";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import { buildQuoteLikeFields } from "@/features/client/components/holiday-fields";
import { factRows } from "@/features/client/lib/holiday-facts";
import { pickCompareQuotes } from "@/features/client/lib/compare-rows";
import { ActivityCard } from "@/features/client/components/holiday/activity-card";
import { CompareCard } from "@/features/client/components/holiday/compare-card";
import { ConvertDialog } from "@/features/client/components/holiday/convert-dialog";
import { FactsCard } from "@/features/client/components/holiday/facts-card";
import { Hero } from "@/features/client/components/holiday/hero";
import { HolidayMessage, HolidayPageShell } from "@/features/client/components/holiday/holiday-page-shell";
import { firstNameOf, type HolidayDetailBaseProps } from "@/features/client/components/holiday/holiday-detail.types";
import { StageBox } from "@/features/client/components/holiday/stage-box";
import { TopBar } from "@/features/client/components/holiday/top-bar";
import { TripCostingsCard } from "@/features/client/components/holiday/trip-costings-card";
import { useHolidayPhotos } from "@/features/client/components/holiday/use-holiday-photos";
import { ViewsCard } from "@/features/client/components/holiday/views-card";

/** The quote page: hero, details and money, activity, stage and compare in the centre; trip and views on the right. */
export function QuoteDetail(props: HolidayDetailBaseProps) {
  const { id, clientId, clientName, clientPhone, clientBadge, readOnly, onOpenExpiryDialog, onDeleted, quotes, bookings } = props;
  const { data: raw, isLoading, error } = useQuote(id);
  const display = useMemo(() => (raw ? transformQuoteData(raw) : null), [raw]);
  const photos = useHolidayPhotos(raw);
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const booking = raw ? bookings.find((b) => b.transaction_id === raw.transaction_id) : undefined;
  const otherQuoteIds = useMemo(
    () => pickCompareQuotes(id, quotes, new Set(bookings.map((b) => b.transaction_id))).map((q) => q.id),
    [id, quotes, bookings],
  );
  const title = display?.quoteTitle || "Untitled quote";
  const openEdit = () => setEditOpen(true);

  const topBar = (
    <TopBar
      mode="quote"
      clientId={clientId}
      clientName={clientName}
      clientPhone={clientPhone}
      clientBadge={clientBadge}
      selection={{ type: "quote", id }}
      quoteData={raw}
      readOnly={readOnly}
      editOpen={editOpen}
      onEditOpenChange={setEditOpen}
      onConvert={() => setConvertOpen(true)}
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
            <Hero
              display={display}
              raw={raw}
              mode="quote"
              photos={photos}
              readOnly={readOnly}
              onOpenPhoto={setViewerIndex}
              onExtendExpiry={() => onOpenExpiryDialog(raw.date_expiry)}
            />
            <FactsCard
              fields={factRows(buildQuoteLikeFields(display))}
              readOnly={readOnly}
              onEdit={openEdit}
              supplierUrl={raw.quote_ref}
            />
            {hasCruise && display.cruise && <CruiseItinerary itinerary={display.cruise.itinerary} />}
            <ActivityCard
              transactionId={raw.transaction_id}
              entityId={id}
              entityType="quote"
              clientId={clientId}
              clientName={clientName}
              readOnly={readOnly}
            />
            <StageBox
              mode="quote"
              quoteId={id}
              createdAt={raw.date_created}
              sentAt={raw.quote_sent_at}
              sentVia={raw.quote_sent_via}
              acceptedAt={raw.accepted_at}
              acceptedByName={raw.accepted_by_name}
              isBooked={!!booking}
              bookedAt={booking?.date_created ?? null}
              readOnly={readOnly}
              clientFirstName={firstNameOf(clientName)}
            />
            <CompareCard
              clientId={clientId}
              clientFirstName={firstNameOf(clientName)}
              current={display}
              currentImageUrl={photos[0]?.url ?? null}
              otherQuoteIds={otherQuoteIds}
            />
          </>
        }
        side={
          <>
            <TripCostingsCard display={display} raw={raw} mode="quote" onEdit={readOnly ? undefined : openEdit} />
            <ViewsCard quoteId={id} sentAt={raw.quote_sent_at} />
          </>
        }
      />
      <PhotoViewer
        images={photos}
        open={viewerIndex !== null}
        index={viewerIndex ?? 0}
        title={display.accommodation.property || title}
        onIndexChange={setViewerIndex}
        onOpenChange={(open) => !open && setViewerIndex(null)}
      />
      {!readOnly && (
        <ConvertDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          quoteId={id}
          clientId={clientId}
          title={title}
          travelDate={display.travelDate}
          total={display.commissions.price}
          operatorName={raw.main_tour_operator_name ?? null}
        />
      )}
    </>
  );
}
