import type { Transaction } from "@/features/quote/types";
import {
  formatCurrency,
  getTransactionProfit,
  getTransactionValue,
  hasQuoteOrBooking,
} from "@/features/pipeline/lib/pipeline-helpers";
import { AMBER_LINK } from "@/features/pipeline/shared/button-styles";

/** Grey money block: Cost + Profit, or "No quote yet" with an add-quote link. */
export function DealCardMoney({ transaction: t, onAddQuote }: { transaction: Transaction; onAddQuote: () => void }) {
  if (!hasQuoteOrBooking(t)) {
    return (
      <div className="flex items-center justify-between rounded-[10px] bg-pipeline-money-bg px-2.5 py-2 text-[12.5px] text-social-muted">
        <span>No quote yet</span>
        <button type="button" className={AMBER_LINK} onClick={(e) => { e.stopPropagation(); onAddQuote(); }} data-testid={`button-add-quote-${t.id}`}>
          + Add quote
        </button>
      </div>
    );
  }
  const cost = getTransactionValue(t);
  const profit = getTransactionProfit(t);
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] bg-pipeline-money-bg px-2.5 py-2 text-[12px] text-social-muted">
      <span>
        Cost <b className="ml-[3px] text-[13.5px] font-semibold text-foreground">{cost > 0 ? formatCurrency(cost) : "TBC"}</b>
      </span>
      <span>
        Profit <b className="ml-[3px] text-[13.5px] font-semibold text-pipeline-profit">{formatCurrency(profit)}</b>
      </span>
    </div>
  );
}
