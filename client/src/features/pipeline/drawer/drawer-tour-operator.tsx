import { ExternalLink } from "lucide-react";
import type { Transaction } from "@/features/quote/types";
import { OperatorTile } from "@/features/pipeline/shared/operator-tile";

/** The deal's main (non-copy) quote, else the first one. */
function mainQuote(t: Transaction) {
  return t.quotes?.find((q) => !q.isQuoteCopy) || t.quotes?.[0];
}

/** Bold first line: the quote name, falling back to the booking title, operator name, then "Quote". */
export function quoteHeadline(t: Transaction, operatorName: string | null): string {
  const quote = mainQuote(t);
  return quote?.title || t.booking?.title || operatorName || "Quote";
}

/** Sub-line: the tour operator, followed by the quote ref when the quote has one. */
export function operatorSubLine(t: Transaction, operatorName: string | null): string {
  const quote = mainQuote(t);
  const name = operatorName || "No tour operator";
  return quote?.quote_ref ? `${name} · Quote ref ${quote.quote_ref}` : name;
}

/** Tour operator row: tile, quote name, operator, quote reference and an "Open quote" link. */
export function DrawerTourOperator({
  transaction: t,
  operator,
  onOpen,
}: {
  transaction: Transaction;
  operator: { name: string | null; logoUrl: string | null };
  onOpen: () => void;
}) {
  const sub = operatorSubLine(t, operator.name);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-pipeline-card-border px-3.5 py-2.5" data-testid="drawer-tour-operator">
      <OperatorTile name={operator.name} logoUrl={operator.logoUrl} size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{quoteHeadline(t, operator.name)}</div>
        <div className="truncate text-[12.5px] text-social-muted">{sub}</div>
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
