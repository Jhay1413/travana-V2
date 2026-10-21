import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, Share2, TreePalm } from "lucide-react";
import { quoteKeys } from "@/hooks/queries";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import { useQuoteGuru, useQuoteImages, useQuotePin, useQuoteShare } from "@/features/quote/components/hooks";
import { QuoteShareDialog } from "@/features/quote/components/QuoteShareDialog";
import { QuoteGuruSheet } from "@/features/quote/components/QuoteGuruSheet";
import { useMarkQuoteSent } from "@/features/quote/api/use-quote-share-queries";
import type { EnrichedQuote } from "@/features/quote/types";
import { AssignedAgentButton } from "@/features/client/components/assigned-agent-button";
import { QuoteActionsMenu } from "@/features/client/components/quote-actions-menu";
import { HOLIDAY_BTN, HOLIDAY_BTN_PRIMARY } from "@/features/client/components/holiday/holiday-styles";
import { TopBarIconButton, TopBarPinButton } from "@/features/client/components/holiday/top-bar-parts";
import { useQuotePreview } from "@/features/client/components/holiday/use-quote-preview";

const COPY_TOAST = "A copy of this quote was made. Change the hotel or dates to offer an alternative.";

export interface QuoteTopActionsProps {
  quoteId: string;
  clientId: string;
  clientName: string;
  quoteData: EnrichedQuote;
  readOnly: boolean;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onConvert: () => void;
  onOpenExpiryDialog: (dateExpiry: string | Date | null | undefined) => void;
  onDeleted: () => void;
}

/** Action row for a quote: Preview, Share, Pin, Duplicate, Convert to booking, assigned agent and the overflow menu. */
export function QuoteTopActions({
  quoteId,
  clientId,
  clientName,
  quoteData,
  readOnly,
  editOpen,
  onEditOpenChange,
  onConvert,
  onOpenExpiryDialog,
  onDeleted,
}: QuoteTopActionsProps) {
  const queryClient = useQueryClient();
  const quote = useMemo(() => transformQuoteData(quoteData), [quoteData]);
  const { quoteImageUrls } = useQuoteImages(quoteData);
  const [copyOpen, setCopyOpen] = useState(false);
  const markSent = useMarkQuoteSent();
  const share = useQuoteShare(quoteId);
  const preview = useQuotePreview(quoteId, quoteData.quote_token);
  const { isFavorited, togglePin } = useQuotePin(quoteId, {
    label: quote.quoteTitle,
    subtitle: `${clientName}${quote.destinationName ? " · " + quote.destinationName : ""}`,
  });
  const guru = useQuoteGuru(quote, quoteData);
  const isLost = quote.status === "lost";

  return (
    <>
      {(!readOnly || quoteData.quote_token) && (
        <TopBarIconButton label="Preview as the customer sees it" onClick={preview.openPreview} disabled={preview.isPending} testId="holiday-top-preview">
          <Eye className="size-[18px]" />
        </TopBarIconButton>
      )}
      {!readOnly && (
        <TopBarIconButton label="Share this quote" onClick={share.openShare} testId="holiday-top-share">
          <Share2 className="size-[18px]" />
        </TopBarIconButton>
      )}
      {guru.guruDestination ? (
        <TopBarIconButton label="Destination Guru" onClick={() => guru.setShowGuruSheet(true)} testId="holiday-top-guru">
          <TreePalm className="size-[18px]" />
        </TopBarIconButton>
      ) : null}
      <TopBarPinButton pinned={isFavorited} onToggle={togglePin} />
      {!readOnly && (
        <>
          <button type="button" className={HOLIDAY_BTN} onClick={() => setCopyOpen(true)} data-testid="holiday-top-duplicate">
            <Copy className="size-4" />
            Duplicate
          </button>
          {!isLost && (
            <button type="button" className={HOLIDAY_BTN_PRIMARY} onClick={onConvert} data-testid="holiday-top-convert">
              <Check className="size-4" />
              Convert to booking
            </button>
          )}
          <AssignedAgentButton
            transactionId={quote.transaction_id}
            userId={quoteData.user_id}
            onReallocated={() => queryClient.invalidateQueries({ queryKey: quoteKeys.all })}
          />
          <QuoteActionsMenu
            quoteId={quoteId}
            quoteData={quoteData}
            quote={quote}
            quoteImageUrls={quoteImageUrls}
            clientId={clientId}
            clientName={clientName}
            onDeleted={onDeleted}
            onOpenExpiryDialog={onOpenExpiryDialog}
            trigger="icon"
            showSetPrimary={quote.isCopyQuote}
            hideItems={["convert", "duplicate"]}
            copySuccessToast={COPY_TOAST}
            editOpen={editOpen}
            onEditOpenChange={onEditOpenChange}
            copyOpen={copyOpen}
            onCopyOpenChange={setCopyOpen}
          />
          <QuoteShareDialog
            open={share.showSharePopup}
            onOpenChange={share.setShowSharePopup}
            shareToken={share.shareToken}
            shareCopied={share.shareCopied}
            shareLoading={share.shareLoading}
            onCopy={share.copyShareLink}
            clientId={clientId || undefined}
            quoteId={quoteId}
            onSent={(via) => markSent.mutate({ quoteId, sentVia: via })}
          />
        </>
      )}
      <QuoteGuruSheet
        open={guru.showGuruSheet}
        onOpenChange={guru.setShowGuruSheet}
        guruDestination={guru.guruDestination}
        guruRecord={guru.guruRecord}
        generateGuruMutation={guru.generateGuruMutation}
      />
    </>
  );
}
