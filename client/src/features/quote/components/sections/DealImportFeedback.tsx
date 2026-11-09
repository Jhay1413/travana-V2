import { X } from "lucide-react";
import type { ImportValidation } from "@/features/quote/api/use-page-capture-import";
import { ImportValidationPanel } from "@/features/quote/components/sections/ImportValidationPanel";
import { hasImportErrors } from "@/features/quote/lib/import-validation";
import { SupplierScraperPicksResultView, type SupplierScraperPicksResult } from "@/features/supplier-scraper";

interface DealImportFeedbackProps {
  validation: ImportValidation | null;
  picks: SupplierScraperPicksResult | null;
  onDismissValidation: () => void;
  onDismissPicks: () => void;
  /** Extra top margin, for the drawer layout where these sit under the import row. */
  spaced?: boolean;
}

/**
 * What the last "Import Deal" produced: validation errors to double-check (warnings are not shown)
 * and, when the capture carried field-picker picks, what got mapped into the
 * supplier's spec. Shared by the quote and booking forms.
 */
export function DealImportFeedback({
  validation,
  picks,
  onDismissValidation,
  onDismissPicks,
  spaced = false,
}: DealImportFeedbackProps) {
  const gap = spaced ? "mt-3" : "";
  return (
    <>
      {validation && hasImportErrors(validation) && (
        <div className={gap}>
          <ImportValidationPanel validation={validation} onDismiss={onDismissValidation} />
        </div>
      )}
      {picks && (
        <div className={`${gap} space-y-2 rounded-xl border border-[#E3E8EF] bg-white p-3`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-[#1F2937]">Field picks applied to this supplier's spec</p>
            <button
              type="button"
              onClick={onDismissPicks}
              aria-label="Dismiss field-pick results"
              className="text-black/40 transition hover:text-black/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <SupplierScraperPicksResultView result={picks} />
        </div>
      )}
    </>
  );
}
