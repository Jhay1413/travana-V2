import { useState } from "react";
import { handleJsonData, type JsonImportDeps } from "@/lib/json-import-handler";
import {
  usePageCaptureImport,
  type CapturedPage,
  type ImportValidation,
} from "@/features/quote/api/use-page-capture-import";
import { withMoneyFieldsQuarantined } from "@/features/quote/lib/import-validation";
import type { SupplierScraperPicksResult } from "@/features/supplier-scraper";
import { useToast } from "@/hooks/use-toast";

/**
 * The "Import Deal" flow shared by the quote and booking forms.
 *
 * For credentialed suppliers the agent captures the deal page in their own
 * (already logged-in) browser via the bookmarklet; the server only interprets
 * it and the result is fed through the same importer into whichever form owns
 * `prepare()`. `prepare` builds the importer deps (and stages image changes)
 * at the moment the import lands.
 */
export function useDealCaptureImport(prepare: () => JsonImportDeps) {
  const { toast } = useToast();
  const pageCaptureImport = usePageCaptureImport();
  // True while the capture is being interpreted and applied — drives the
  // blurred loading overlay over the whole form.
  const [isImporting, setIsImporting] = useState(false);
  // The API validates the extracted quote but never blocks on it — the deal
  // always lands in the form. This is purely "double-check these before saving".
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  // Present only when the capture carried field-picker picks.
  const [picks, setPicks] = useState<SupplierScraperPicksResult | null>(null);

  const importCapture = (capture: CapturedPage, supplierKey: string) => {
    setIsImporting(true);
    setValidation(null);
    setPicks(null);
    pageCaptureImport.mutate(
      // Omit the key entirely when auto-detecting, rather than sending "".
      supplierKey ? { ...capture, supplierKey } : capture,
      {
        onSuccess: async (result) => {
          try {
            // Money fields that failed validation are dropped rather than
            // auto-filled — the agent types the number instead.
            const quoteForImport = withMoneyFieldsQuarantined(result.quote, result.validation);
            await handleJsonData(quoteForImport as Record<string, unknown>, prepare());
            setValidation(result.validation ?? null);
            setPicks(result.picks ?? null);
            // Surfaces "created supplier X / learned its spec — review it".
            if (result.message) toast({ title: "Imported", description: result.message });
          } finally {
            setIsImporting(false);
          }
        },
        onError: (error) => {
          setIsImporting(false);
          toast({
            title: "Import failed",
            description: error instanceof Error ? error.message : "Could not read the captured page.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return {
    importCapture,
    isImporting,
    isPending: pageCaptureImport.isPending,
    validation,
    picks,
    dismissValidation: () => setValidation(null),
    dismissPicks: () => setPicks(null),
  };
}
