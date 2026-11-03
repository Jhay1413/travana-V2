import { Link } from "wouter";
import { FormDescription } from "@/components/ui/form";
import { findOperator } from "../lib/operator-options";
import type { TourOperator } from "../types";

const PAGE_PATH = "/agency/tour-operators";

/** Hint under a Tour operator field: empty list, or a selected operator with no commission rate. */
export function OperatorRateHint({ operators, selectedId }: { operators: TourOperator[] | undefined; selectedId?: string | null }) {
  if (!operators) return null;
  const pageLink = (
    <Link href={PAGE_PATH} className="underline underline-offset-2">
      Tour Operators
    </Link>
  );
  if (operators.length === 0) {
    return <FormDescription className="text-xs">No tour operators yet. Add them on {pageLink}.</FormDescription>;
  }
  const selected = findOperator(operators, selectedId);
  if (selected && selected.commission_percentage == null) {
    return (
      <FormDescription className="text-xs">
        No commission rate set for {selected.name ?? "this operator"}. Set it on {pageLink}.
      </FormDescription>
    );
  }
  return null;
}
