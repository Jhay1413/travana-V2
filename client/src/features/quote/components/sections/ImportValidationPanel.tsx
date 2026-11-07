import { AlertCircle, X } from "lucide-react";
import type { ImportValidation } from "@/features/quote/api/use-page-capture-import";
import { getImportErrors } from "@/features/quote/lib/import-validation";

interface ImportValidationPanelProps {
  validation: ImportValidation;
  onDismiss: () => void;
}

// Surfaces real errors the scrape/import API found with the deal it just
// returned (e.g. a money field left blank on purpose). Never blocks anything —
// the quote already landed in the form. Warnings are intentionally not shown:
// the panel only appears when there is at least one error.
export function ImportValidationPanel({ validation, onDismiss }: ImportValidationPanelProps) {
  const errors = getImportErrors(validation);
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-black/10 bg-white/70 p-3" data-testid="import-validation-panel">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-black/70">Check this import before saving</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss import errors"
          className="text-black/40 transition hover:text-black/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <ul className="space-y-1.5 text-xs text-black/70">
          {errors.map((issue, i) => (
            <li key={i}>
              {issue.fieldLabel && <span className="font-medium text-red-700">{issue.fieldLabel}: </span>}
              {issue.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
