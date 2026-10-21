import { ExternalLink } from "lucide-react";
import type { Transaction } from "@/features/quote/types";
import { OperatorTile } from "@/features/pipeline/shared/operator-tile";

/** Sub-line under the operator name: the quote ref when the data has one, else the quote title. */
export function operatorSubLine(t: Transaction): string | null {
  const quote = t.quotes?.find((q) => !q.isQuoteCopy) || t.quotes?.[0];
  if (quote?.quote_ref) return `Quote ref ${quote.quote_ref} · sent by email`;
  if (quote) return quote.title || "Quote";
  return t.booking?.title || null;
}

/** Tour operator row: tile, name, quote reference and an "Open quote" link. */
export function DrawerTourOperator({
  transaction: t,
  operator,
  onOpen,
}: {
  transaction: Transaction;
  operator: { name: string | null; logoUrl: string | null };
  onOpen: () => void;
}) {
  const sub = operatorSubLine(t);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-pipeline-card-border px-3.5 py-2.5" data-testid="drawer-tour-operator">
      <OperatorTile name={operator.name} logoUrl={operator.logoUrl} size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{operator.name || "No tour operator"}</div>
        {sub && <div className="truncate text-[12.5px] text-social-muted">{sub}</div>}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-social-orange-text hover:underline"
        data-testid="button-open-quote"
      >
        Open quote<ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
