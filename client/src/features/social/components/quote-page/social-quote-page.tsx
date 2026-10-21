import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PhotoViewer } from "@/components/shared/photo-viewer";
import { useToast } from "@/hooks/use-toast";
import { useDeleteQuote } from "@/hooks/mutations";
import { quoteKeys, useQuote } from "@/hooks/queries";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import { CruiseItinerary } from "@/features/quote/components/CruiseItinerary";
import { QuoteGuruSheet } from "@/features/quote/components/QuoteGuruSheet";
import { QuoteEditDialog } from "@/features/quote/components/quote-edit-dialog";
import { QuoteExpiryDialog } from "@/features/quote/components/QuoteExpiryDialog";
import { useQuoteExpiry, useQuoteGuru, useQuoteImages, useQuotePin } from "@/features/quote/components/hooks";
import { buildQuoteLikeFields } from "@/features/client/components/holiday-fields";
import { factRows } from "@/features/client/lib/holiday-facts";
import { ActivityCard } from "@/features/client/components/holiday/activity-card";
import { FactsCard } from "@/features/client/components/holiday/facts-card";
import { Hero } from "@/features/client/components/holiday/hero";
import { HolidayMessage, HolidayTwoUp } from "@/features/client/components/holiday/holiday-page-shell";
import { MoneyCard } from "@/features/client/components/holiday/money-card";
import { TripCard } from "@/features/client/components/holiday/trip-card";
import { useHolidayPhotos } from "@/features/client/components/holiday/use-holiday-photos";
import { ViewsCard } from "@/features/client/components/holiday/views-card";
import { SocialQuoteCopyFlow } from "./social-quote-copy-flow";
import { SocialQuoteDeleteDialog } from "./social-quote-delete-dialog";
import { SocialQuoteShell } from "./social-quote-shell";
import { SocialQuoteTopBar } from "./social-quote-top-bar";

/**
 * The social "View quote" page, built from the same cards as the client quote page. A free quote has no client, so
 * there is no rail, stage box or compare card, and the activity card shows Notes and Tasks only.
 * Free quotes stay editable for the social media manager, so nothing here is read-only.
 */
export function SocialQuotePageView({ quoteId }: { quoteId: string }) {
  const [, setLocation] = useLocation();
  // The board passes its filter query string as ?from= so going back restores the view.
  const from = new URLSearchParams(useSearch()).get("from");
  const boardPath = from ? `/social-posts?${from}` : "/social-posts";

  const { data: raw, isLoading, error } = useQuote(quoteId);
  const display = useMemo(() => (raw ? transformQuoteData(raw) : null), [raw]);
  const photos = useHolidayPhotos(raw);
  const { quoteImageUrls } = useQuoteImages(raw);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const guru = useQuoteGuru(display, raw);
  const quoteExpiry = useQuoteExpiry(quoteId);
  const deleteQuote = useDeleteQuote();
  const { isFavorited, togglePin } = useQuotePin(quoteId, {
    label: display?.quoteTitle ?? "",
    subtitle: display?.destinationName ? ` · ${display.destinationName}` : "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-social-quote">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !raw || !display) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-social-quote">
        <div className="text-center">
          <p className="text-sm text-black/70">Failed to load quote</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setLocation(boardPath)}>
            Back to Social Posts
          </Button>
        </div>
      </div>
    );
  }

  async function handleConfirmDelete() {
    try {
      await deleteQuote.mutateAsync(quoteId);
      toast({ title: "Quote deleted" });
      setLocation(boardPath);
    } catch {
      toast({ title: "Failed to delete quote", variant: "destructive" });
      setDeleteOpen(false);
    }
  }

  const openExpiry = () => quoteExpiry.openExpiryDialog(raw.date_expiry);
  const hasCruise = (display.cruise?.itinerary?.length ?? 0) > 0;
  const title = display.quoteTitle || "Social quote";

  return (
    <>
      <SocialQuoteShell
        topBar={
          <SocialQuoteTopBar
            title={display.quoteTitle}
            status={display.status}
            boardPath={boardPath}
            supplierUrl={raw.quote_ref}
            hasGuru={!!guru.guruDestination}
            pinned={isFavorited}
            onTogglePin={togglePin}
            onOpenGuru={() => guru.setShowGuruSheet(true)}
            onCopy={() => setCopyOpen(true)}
            onEdit={() => setEditOpen(true)}
            onUpdateExpiry={openExpiry}
            onDelete={() => setDeleteOpen(true)}
          />
        }
        main={
          <>
            <Hero display={display} raw={raw} mode="quote" photos={photos} onOpenPhoto={setViewerIndex} onExtendExpiry={openExpiry} />
            <HolidayTwoUp>
              <FactsCard fields={factRows(buildQuoteLikeFields(display))} readOnly={false} onEdit={() => setEditOpen(true)} supplierUrl={raw.quote_ref} />
              <MoneyCard raw={raw} mode="quote" />
            </HolidayTwoUp>
            {hasCruise && display.cruise && <CruiseItinerary itinerary={display.cruise.itinerary} />}
            {raw.transaction_id ? (
              <ActivityCard transactionId={raw.transaction_id} entityId={quoteId} entityType="quote" clientId="" clientName="" readOnly={false} />
            ) : (
              <HolidayMessage>Notes need a client.</HolidayMessage>
            )}
          </>
        }
        side={
          <>
            <TripCard display={display} onEdit={() => setEditOpen(true)} />
            <ViewsCard quoteId={quoteId} sentAt={raw.quote_sent_at} />
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

      <QuoteEditDialog
        quoteId={quoteId}
        open={editOpen}
        onOpenChange={setEditOpen}
        presentation="drawer"
        onSuccess={() => {
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
        }}
      />

      <QuoteGuruSheet
        open={guru.showGuruSheet}
        onOpenChange={guru.setShowGuruSheet}
        guruDestination={guru.guruDestination}
        guruRecord={guru.guruRecord}
        generateGuruMutation={guru.generateGuruMutation}
      />

      <QuoteExpiryDialog
        open={quoteExpiry.showExpiryDialog}
        onOpenChange={quoteExpiry.setShowExpiryDialog}
        expiryDate={quoteExpiry.expiryDate}
        onExpiryDateChange={quoteExpiry.setExpiryDate}
        isPending={quoteExpiry.updateQuoteExpiryMutation.isPending}
        onConfirm={quoteExpiry.confirmExpiry}
      />

      <SocialQuoteDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} isPending={deleteQuote.isPending} onConfirm={handleConfirmDelete} />

      <SocialQuoteCopyFlow quote={raw} quoteImageUrls={quoteImageUrls} open={copyOpen} onOpenChange={setCopyOpen} />
    </>
  );
}
