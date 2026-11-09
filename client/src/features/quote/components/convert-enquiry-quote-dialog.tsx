import { useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { FormCloseButton, FormHead, FormOverlay } from "@/components/shared/form-shell";
import { useEnquiry, usePackageTypes } from "@/hooks/queries";
import { useCreateQuote, useUpdateEnquiry } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { buildQuotePayload } from "@/features/quote/components/quote-create-dialog";
import { QuoteRHFForm } from "@/features/quote/components/quote-rhf-form";
import { buildQuoteInitialValuesFromEnquiry } from "@/features/quote/lib/enquiry-to-quote";
import type { CreateQuoteData, QuoteFormValues } from "@/features/quote/types";

export interface ConvertEnquiryQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiryId: string;
  /** The enquiry's transaction; the new quote is created on it. */
  transactionId?: string | null;
  clientId?: string;
  /** Called after the quote is created and the enquiry marked Converted (e.g. to navigate to it). */
  onConverted?: (quoteId: string) => void;
}

/**
 * "Convert to quote": the quote pop-up pre-filled from an enquiry. On save it creates the quote
 * on the enquiry's transaction and marks the enquiry Converted. Shared by the enquiry page, the
 * enquiry "···" menu and the enquiry form's "Save & start quote".
 */
export function ConvertEnquiryQuoteDialog({ open, onOpenChange, enquiryId, transactionId, onConverted }: ConvertEnquiryQuoteDialogProps) {
  const { toast } = useToast();
  const { data: enquiry, isLoading, isError } = useEnquiry(open ? enquiryId : "");
  const { data: packageTypesData } = usePackageTypes();
  const createQuote = useCreateQuote();
  const updateEnquiry = useUpdateEnquiry();

  const defaultValues = useMemo<Partial<QuoteFormValues>>(() => (enquiry ? buildQuoteInitialValuesFromEnquiry(enquiry) : {}), [enquiry]);

  const handleSubmit = (values: QuoteFormValues, images?: { files: File[]; urls: string[] }) => {
    const targetTransactionId = transactionId || enquiry?.transaction_id;
    if (!enquiry || !targetTransactionId) {
      toast({
        title: "Conversion Error",
        description: "This enquiry is missing a transaction ID and cannot be converted.",
        variant: "destructive",
      });
      return;
    }

    const imageUrls = images?.urls || [];
    const convertPayload: CreateQuoteData = {
      ...buildQuotePayload(values, packageTypesData),
      transaction_id: targetTransactionId,
      ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
    } as CreateQuoteData;

    createQuote.mutate(convertPayload, {
      onSuccess: (newQuote: { id: string }) => {
        updateEnquiry.mutate({ id: enquiry.id, data: { status: "Converted" } });
        onOpenChange(false);
        toast({ title: "Enquiry converted to quote!" });
        onConverted?.(newQuote.id);
      },
      onError: () => toast({ title: "Failed to convert enquiry to quote", variant: "destructive" }),
    });
  };

  if (!open) return null;

  return (
    <FormOverlay label="Convert enquiry to quote" onClose={() => onOpenChange(false)} preventClose={createQuote.isPending} variant="popup" data-testid="convert-enquiry-drawer">
      {isLoading && (
        <>
          <FormHead title="Convert enquiry to quote" right={<FormCloseButton onClick={() => onOpenChange(false)} />} />
          <div className="flex flex-1 items-center justify-center py-24">
            <Spinner className="h-6 w-6" />
          </div>
        </>
      )}
      {isError && (
        <>
          <FormHead title="Convert enquiry to quote" right={<FormCloseButton onClick={() => onOpenChange(false)} />} />
          <div className="py-24 text-center text-sm text-red-500">Failed to load the enquiry.</div>
        </>
      )}
      {!isLoading && !isError && enquiry && (
        <QuoteRHFForm
          key={enquiryId + open}
          title="Convert enquiry to quote"
          note="Filled in from the enquiry. Check the details, then create the quote."
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={createQuote.isPending}
          submitLabel="Convert to Quote"
          onCancel={() => onOpenChange(false)}
        />
      )}
    </FormOverlay>
  );
}
