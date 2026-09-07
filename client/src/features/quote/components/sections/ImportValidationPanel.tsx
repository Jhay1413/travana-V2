import { AlertCircle, AlertTriangle, X } from "lucide-react";
import type { ImportValidation } from "@/features/quote/api/use-page-capture-import";
import { describeImportIssue } from "@/features/quote/lib/import-validation";

interface ImportValidationPanelProps {
  validation: ImportValidation;
  onDismiss: () => void;
}

// Surfaces what the scrape/import API found wrong with the deal it just
// returned. Never blocks anything — the quote already landed in the form —
// this is purely "here's what to double-check", split so errors (a money
// field was left blank on purpose) read as more urgent than warnings.
export function ImportValidationPanel({ validation, onDismiss }: ImportValidationPanelProps) {
  if (validation.issues.length === 0) return null;

  const errors = validation.issues.filter((i) => i.level === "error").map(describeImportIssue);
  const warnings = validation.issues.filter((i) => i.level === "warn").map(describeImportIssue);

  return (
    <div className="space-y-2 rounded-xl border border-black/10 bg-white/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-black/70">Check this import before saving</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss import warnings"
          className="text-black/40 transition hover:text-black/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {errors.length > 0 && (
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
      )}

      {warnings.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <ul className="space-y-1.5 text-xs text-black/70">
            {warnings.map((issue, i) => (
              <li key={i}>
                {issue.fieldLabel && <span className="font-medium text-amber-700">{issue.fieldLabel}: </span>}
                {issue.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
