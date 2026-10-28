import { ExternalLink, Pencil } from "lucide-react";
import { FIELD_ICONS } from "@/features/client/components/holiday-field-icons";
import type { FactRow } from "@/features/client/lib/holiday-facts";
import { HOLIDAY_BTN_GHOST, HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

/**
 * "Holiday details" card: responsive grid (5 columns wide, down to 1) of icon chips with a label and value.
 *
 * Props:
 * - fields: rows to show; build them with factRows(buildQuoteLikeFields(display)) (rows without a value are already dropped).
 * - readOnly: hides the Edit button.
 * - onEdit: opens the edit drawer (the page sets TopBar's editOpen). Without it the button is hidden too.
 * - supplierUrl: when set, a small "Supplier page" link opens it in a new tab (quote_ref).
 * - title: card heading, "Holiday details" by default.
 */
export interface FactsCardProps {
  fields: FactRow[];
  readOnly: boolean;
  onEdit?: () => void;
  supplierUrl?: string | null;
  title?: string;
}

export function FactsCard({ fields, readOnly, onEdit, supplierUrl, title = "Holiday details" }: FactsCardProps) {
  return (
    <section className={HOLIDAY_CARD} aria-labelledby="holiday-facts-title" data-testid="holiday-facts-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 id="holiday-facts-title" className="text-base font-semibold leading-snug">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {supplierUrl && /^https?:\/\//i.test(supplierUrl) && (
            <a href={supplierUrl} target="_blank" rel="noopener noreferrer" className={HOLIDAY_BTN_GHOST} data-testid="holiday-facts-supplier-link">
              Supplier page
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {!readOnly && onEdit && (
            <button type="button" className={HOLIDAY_BTN_GHOST} onClick={onEdit} data-testid="holiday-facts-edit">
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </button>
          )}
        </div>
      </div>
      {fields.length === 0 ? (
        <p className="text-[13px] text-qp-muted">No details yet.</p>
      ) : (
        <div className="grid grid-cols-5 gap-x-4 gap-y-3 max-[1700px]:grid-cols-4 max-[1280px]:grid-cols-3 max-[860px]:grid-cols-2 max-[620px]:grid-cols-1" data-testid="holiday-facts-grid">
          {fields.map((field) => {
            const Icon = FIELD_ICONS[field.icon];
            return (
              <div key={field.key} className="flex min-w-0 items-start gap-3" data-testid={`holiday-fact-${field.key}`}>
                <span className="grid size-[30px] shrink-0 place-items-center rounded-[10px] bg-qp-chip-bg text-qp-chip-fg" aria-hidden>
                  <Icon className="size-[15px]" />
                </span>
                <div className="min-w-0">
                  <span className="block text-xs text-qp-muted">{field.label}</span>
                  <b className="block break-words text-[13.5px] font-semibold leading-snug">{field.value}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
