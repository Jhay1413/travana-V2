import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/features/quote/types";
import {
  formatCurrency,
  getTransactionProfit,
  getTransactionValue,
  hasQuoteOrBooking,
} from "@/features/pipeline/lib/pipeline-helpers";
import { marginPercent } from "@/features/pipeline/lib/pipeline-money";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex-1 rounded-xl border border-pipeline-card-border px-3.5 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-social-muted">{label}</div>
      <div className={`mt-0.5 text-[20px] font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}

/** Cost / Profit / Margin tiles, or "No quote yet" with an Add quote button. */
export function DrawerMoney({ transaction: t, onAddQuote }: { transaction: Transaction; onAddQuote: () => void }) {
  if (!hasQuoteOrBooking(t)) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-pipeline-money-bg px-3.5 py-2.5 text-[13px] text-social-muted">
        <span className="flex-1">No quote yet</span>
        <Button type="button" variant="outline" className={`${OUTLINE_ACTION} h-[34px] px-3.5`} onClick={onAddQuote}>
          <Plus className="h-4 w-4" />Add quote
        </Button>
      </div>
    );
  }
  const cost = getTransactionValue(t);
  const profit = getTransactionProfit(t);
  const margin = marginPercent(profit, cost);
  return (
    <div className="flex gap-2.5">
      <Stat label="Cost" value={cost > 0 ? formatCurrency(cost) : "TBC"} />
      <Stat label="Profit" value={formatCurrency(profit)} className="text-pipeline-profit" />
      <Stat label="Margin" value={margin !== null ? `${margin}%` : "None"} />
    </div>
  );
}
