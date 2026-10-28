import { useQueryClient } from "@tanstack/react-query";
import { transactionKeys } from "@/hooks/queries";
import { useUpdateEnquiry } from "@/hooks/mutations";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import type { PipelineDialogs } from "@/features/pipeline/state/use-pipeline-dialogs";
import type { PipelineParking } from "@/features/pipeline/state/use-pipeline-parking";
import { ConvertToBookingDialog } from "./convert-to-booking-dialog";
import { MarkLostDialog } from "./mark-lost-dialog";
import { MoveToFutureDialog } from "./move-to-future-dialog";

/** Every dialog the pipeline page can open, driven by `usePipelineDialogs`. */
export function PipelineDialogsHost({
  dialogs,
  parking,
}: {
  dialogs: PipelineDialogs;
  parking: PipelineParking;
}) {
  const queryClient = useQueryClient();
  const updateEnquiry = useUpdateEnquiry();
  const { quoteDialog, setQuoteDialog, bookingQuoteId, setBookingQuoteId, futureDialog, setFutureDialog, lostConfirm, setLostConfirm } = dialogs;

  return (
    <>
      {quoteDialog && (
        <QuoteCreateDialog
          presentation="drawer"
          transactionId={quoteDialog.transactionId}
          clientId={quoteDialog.clientId}
          userId={quoteDialog.userId}
          initialValues={quoteDialog.targetStage === "In Play" ? { ...quoteDialog.initialValues, status: "in_play" } : quoteDialog.initialValues}
          open
          onOpenChange={(o) => { if (!o) setQuoteDialog(null); }}
          onSuccess={() => {
            if (quoteDialog.enquiryId) {
              updateEnquiry.mutate({ id: quoteDialog.enquiryId, data: { status: "Converted" } });
            }
            setQuoteDialog(null);
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          }}
        />
      )}

      <ConvertToBookingDialog quoteId={bookingQuoteId} onClose={() => setBookingQuoteId(null)} />

      <MoveToFutureDialog
        open={!!futureDialog}
        onOpenChange={(o) => { if (!o) setFutureDialog(null); }}
        onConfirm={(date) => {
          if (!futureDialog) return;
          parking.confirmFuture(futureDialog.tx, futureDialog.fromStage, date);
        }}
        isSubmitting={parking.isFuturePending}
      />

      <MarkLostDialog
        open={!!lostConfirm}
        onCancel={() => setLostConfirm(null)}
        onConfirm={() => {
          if (lostConfirm) parking.handleSetLost(lostConfirm.tx, lostConfirm.stage, true);
          setLostConfirm(null);
        }}
      />

    </>
  );
}
